import pandas as pd


CANONICAL_COLUMNS = ["Head", "Relation", "Tail"]


def _triple_key(row) -> tuple[str, str, str]:
    return (str(row["Head"]), str(row["Relation"]), str(row["Tail"]))


def _triple_dict(head: str, relation: str, tail: str) -> dict[str, str]:
    return {"Head": str(head), "Relation": str(relation), "Tail": str(tail)}


def extract_unique_pair(df:pd.DataFrame, columns:list) -> pd.DataFrame:
    """Extracts unique pairs from a dataframe.
    
    Parameters
    ----------
    df : pd.DataFrame
        Dataframe to extract unique pairs from.
    columns : list
        List of columns to extract unique pairs from.
    
    Returns
    -------
    pd.DataFrame
        Dataframe of unique pairs.
    """
    df_unique = df.drop_duplicates(subset=columns).reset_index(drop=True)
    return df_unique

def extract_unique_rel_tail(df: pd.DataFrame) -> pd.DataFrame:
    """
    Take a dataframe and return every pair of relations and tail in the dataframe.

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to extract relations and tails from.

    Returns
    -------
    pd.DataFrame
        A dataframe containing every pair of relations and tails in the input dataframe.

    """
    columns = ['Relation', 'Tail']
    df_unique = extract_unique_pair(df, columns)
    df_unique = df_unique[columns]
    return df_unique
    
def extract_head_cluster(df: pd.DataFrame) -> list:
    """
    Extracts the head entities that share the same head entity for each unique pair of relation and tail in a dataframe.

    Parameters
    ----------
    df : pd.DataFrame
        The input dataframe containing the head, relation, and tail entities.

    Returns
    -------
    list
        A list of pandas dataframes, where each dataframe contains the head entities that share the same head entity for a unique pair of relation and tail.

    """
    # get every unique pair of relation and tail
    df_rel_tail = extract_unique_rel_tail(df)
    list_rel_tail = [row for index, row in df_rel_tail.iterrows()]
    # init head clusters
    list_head_cluster = []
    # for every pair, extract the head that share the same head
    for pair in list_rel_tail:
        cluster = pd.DataFrame()
        relation = pair['Relation']
        tail = pair['Tail']
        # condition to validate
        conditions = (df['Relation'] == relation) & (df['Tail'] == tail)
        cluster = df['Head'][conditions].drop_duplicates()
        if len(cluster) > 1:
            list_head_cluster.append(cluster)
    return list_head_cluster


def extract_relation_tail_clusters(df: pd.DataFrame) -> list[dict]:
    """Return relation-tail clusters used by OMNIA candidate propagation.

    A cluster is formed when two or more head entities share the same
    (Relation, Tail) pair. The UI and backend use this richer record shape to
    explain why a candidate was generated.
    """
    if df.empty:
        return []

    required = set(CANONICAL_COLUMNS)
    if not required.issubset(df.columns):
        missing = ", ".join(sorted(required - set(df.columns)))
        raise ValueError(f"Missing required triple columns: {missing}")

    clean_df = df[CANONICAL_COLUMNS].dropna().astype(str).drop_duplicates()
    clusters: list[dict] = []
    for _, ((relation, tail), group) in enumerate(
        clean_df.groupby(["Relation", "Tail"], sort=True),
        start=1,
    ):
        heads = sorted(group["Head"].drop_duplicates().tolist())
        if len(heads) < 2:
            continue
        cluster_index = len(clusters) + 1
        cluster_id = f"cluster-{cluster_index}"
        cluster_key = f"{relation} -> {tail}"
        clusters.append(
            {
                "cluster_id": cluster_id,
                "cluster_key": cluster_key,
                "relation": relation,
                "tail": tail,
                "heads": heads,
                "size": len(heads),
                "warning": (
                    "Weak propagation signal: only two heads share this relation-tail pair."
                    if len(heads) <= 2
                    else None
                ),
            }
        )
    return clusters

def generate_combination_cluster(df: pd.DataFrame, cluster: pd.Series) -> pd.DataFrame:
    """
    Generate all possible combinations of entities in a given cluster.

    Parameters
    ----------
    df : pd.DataFrame
        The input dataframe containing the head, relation, and tail entities.
    cluster : pd.Series
        A series of entities that belong to the same cluster.

    Returns
    -------
    pd.DataFrame
        A dataframe containing all possible combinations of entities in the given cluster.

    """
    rel_tail_cluster = df[["Relation", "Tail"]][df["Head"].isin(cluster)].drop_duplicates()
    head_series = cluster.repeat(len(rel_tail_cluster)).reset_index(drop=True)
    rel_tail_df = pd.concat([rel_tail_cluster] *len(cluster), ignore_index=True)
    combination_df = pd.concat([head_series, rel_tail_df], axis=1)
    return combination_df

def generate_all_candidates(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generate all possible combinations of entities in the input dataframe.

    Parameters
    ----------
    df : pd.DataFrame
        The input dataframe containing the head, relation, and tail entities.

    Returns
    -------
    pd.DataFrame
        A dataframe containing all possible combinations of entities in the input dataframe.

    """
    records = generate_candidate_records(df)
    if records.empty:
        return pd.DataFrame(columns=CANONICAL_COLUMNS)
    return (
        records[~records["status_duplicate_existing"]][CANONICAL_COLUMNS]
        .drop_duplicates()
        .reset_index(drop=True)
    )


def generate_candidate_records(df: pd.DataFrame) -> pd.DataFrame:
    """Generate candidates with provenance and duplicate status.

    For every relation-tail cluster, each head in the cluster inherits the
    relation-tail pairs observed on the other heads. Existing triples are kept
    in the returned frame with ``status_duplicate_existing=True`` so the demo can
    explain propagation coverage without sending those rows to filtering.
    """
    output_columns = [
        "Head",
        "Relation",
        "Tail",
        "status_duplicate_existing",
        "cluster_ids",
        "cluster_keys",
        "source_heads",
        "provenance",
        "rationale",
    ]
    if df.empty:
        return pd.DataFrame(columns=output_columns)

    required = set(CANONICAL_COLUMNS)
    if not required.issubset(df.columns):
        missing = ", ".join(sorted(required - set(df.columns)))
        raise ValueError(f"Missing required triple columns: {missing}")

    clean_df = df[CANONICAL_COLUMNS].dropna().astype(str).drop_duplicates().reset_index(drop=True)
    existing_keys = {_triple_key(row) for _, row in clean_df.iterrows()}
    clusters = extract_relation_tail_clusters(clean_df)
    records: dict[tuple[str, str, str], dict] = {}

    for cluster in clusters:
        heads = list(cluster["heads"])
        member_df = clean_df[clean_df["Head"].isin(heads)].copy()
        relation_tail_pairs = (
            member_df[["Relation", "Tail"]]
            .drop_duplicates()
            .sort_values(["Relation", "Tail"])
            .reset_index(drop=True)
        )
        source_triples = [
            _triple_dict(row["Head"], row["Relation"], row["Tail"])
            for _, row in member_df[
                (member_df["Relation"] == cluster["relation"])
                & (member_df["Tail"] == cluster["tail"])
            ].sort_values(["Head", "Relation", "Tail"]).iterrows()
        ]

        for head in heads:
            for _, pair in relation_tail_pairs.iterrows():
                relation = str(pair["Relation"])
                tail = str(pair["Tail"])
                key = (str(head), relation, tail)
                duplicate = key in existing_keys
                if key not in records:
                    records[key] = {
                        "Head": key[0],
                        "Relation": key[1],
                        "Tail": key[2],
                        "status_duplicate_existing": duplicate,
                        "cluster_ids": [],
                        "cluster_keys": [],
                        "source_heads": [],
                        "provenance": {},
                        "rationale": "",
                    }

                record = records[key]
                if cluster["cluster_id"] not in record["cluster_ids"]:
                    record["cluster_ids"].append(cluster["cluster_id"])
                if cluster["cluster_key"] not in record["cluster_keys"]:
                    record["cluster_keys"].append(cluster["cluster_key"])
                for source_head in heads:
                    if source_head not in record["source_heads"]:
                        record["source_heads"].append(source_head)

                if not record["provenance"]:
                    record["provenance"] = {
                        "cluster_id": cluster["cluster_id"],
                        "cluster_key": cluster["cluster_key"],
                        "source_heads": heads,
                        "source_triples": source_triples,
                        "generated_candidate": _triple_dict(key[0], key[1], key[2]),
                    }

                if duplicate:
                    record["rationale"] = (
                        "Already present in the known graph; kept to show the relation-tail propagation path."
                    )
                else:
                    record["rationale"] = (
                        f"Generated because {', '.join(heads[:4])} share "
                        f"{cluster['cluster_key']} and exchange observed relation-tail evidence."
                    )

    if not records:
        return pd.DataFrame(columns=output_columns)

    result = pd.DataFrame(records.values())
    result = result.sort_values(
        ["status_duplicate_existing", "Relation", "Tail", "Head"],
        kind="stable",
    ).reset_index(drop=True)
    return result[output_columns]

import pandas as pd
from candidates_filtering.embedding import train_model
from candidates_filtering.embedding.get_emb_transe import get_list_dist
from candidates_filtering import triple_filter

def train_transe_embedding(df:pd.DataFrame):
    """
    Train TransE embedding on a dataframe and return the training df with the embedding model
    """
    train_df = train_model.create_dataset(
        df)
    test_df = train_model.create_dataset(
        df.sample(n=50))
    embedding_dim = 5
    model_kwargs = {"embedding_dim": embedding_dim}

    model_name = 'TransE'
    experiment_name = model_name+f"_dim{embedding_dim}"
    model = train_model.create_pipeline(
        train_df,
        test_df,
        model_name,
        model_kwargs,
        experiment_name,
        preferred_device="cuda",
        use_wandb=False,
    )
    return model, train_df

def get_filtred_df(model, candidates_df:pd.DataFrame, missing_df:pd.DataFrame, train_df:pd.DataFrame) -> pd.DataFrame:
    """
    Filter the dataframe using the best threshold for TransE score
    """
    list_dist = get_list_dist(candidates_df,model.model, train_df)
    candidates_df['distance'] = list_dist
    _, filtred_df = triple_filter.filter_best_threshold(model, candidates_df, missing_df, train_df)
    return filtred_df

def create_filtred_df(df:pd.DataFrame, candidates_df:pd.DataFrame, missing_df:pd.DataFrame) -> pd.DataFrame:
    """
    Creating filtred dataframe dataframe using the best threshold for TransE score
    """
    model, train_df = train_transe_embedding(df)
    filtred_df = get_filtred_df(model,candidates_df, missing_df, train_df)
    return filtred_df

def create_sample(df:pd.DataFrame, sample_size:int=500, true_cand_ratio:float=0.5) -> pd.DataFrame:
    """
    Creating sample of the dataframe
    """
    true_cand_size = int(sample_size * true_cand_ratio)
    false_cand_size = sample_size - true_cand_size
    true_cand_df = df[df['Missing'] == 1].sample(true_cand_size)
    false_cand_df = df[df['Missing'] == 0].sample(false_cand_size)
    df_sample = pd.concat([true_cand_df, false_cand_df])
    df_sample = df_sample.sample(frac=1)
    return df_sample


def _as_records(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["Head", "Relation", "Tail"])
    return df[["Head", "Relation", "Tail"]].astype(str).reset_index(drop=True)


def run_filter_pipeline(
    known_df: pd.DataFrame,
    candidates_df: pd.DataFrame,
    missing_df: pd.DataFrame,
    *,
    preferred_device: str | None = "cuda",
    use_wandb: bool = False,
    embedding_dim: int = 5,
    num_epochs: int = 50,
) -> dict:
    """
    Full TransE filtering pipeline used by backend services.
    Returns scored candidates, threshold diagnostics, selected threshold, and accepted/rejected triples.
    """
    known_triples = _as_records(known_df)
    candidate_triples = _as_records(candidates_df)
    missing_triples = _as_records(missing_df)
    if candidate_triples.empty:
        return {
            "metadata": {
                "model_name": "TransE",
                "embedding_dim": embedding_dim,
                "optimizer": train_model.OPTIMIZER,
                "learning_rate": train_model.OPTIMIZER_KWARGS.get("lr"),
                "epochs": num_epochs,
                "device": train_model.resolve_device(preferred_device),
                "fallback": False,
            },
            "threshold": None,
            "threshold_diagnostics": [],
            "scored_candidates_df": candidate_triples.assign(distance=[]),
            "accepted_df": candidate_triples.iloc[0:0].copy(),
            "rejected_df": candidate_triples.iloc[0:0].copy(),
        }

    train_factory = train_model.create_dataset(known_triples)
    test_source = known_triples.sample(n=min(50, len(known_triples)), random_state=42)
    test_factory = train_model.create_dataset(test_source)
    model_kwargs = {"embedding_dim": embedding_dim}
    result = train_model.create_pipeline(
        train_factory,
        test_factory,
        "TransE",
        model_kwargs,
        "TransE_filtering",
        num_epochs=num_epochs,
        preferred_device=preferred_device,
        use_wandb=use_wandb,
    )

    scored_candidates_df = candidate_triples.copy()
    scored_candidates_df["distance"] = get_list_dist(
        scored_candidates_df,
        result.model,
        train_factory,
    )
    threshold_diagnostics = triple_filter.get_threshold_diagnostics(
        scored_candidates_df,
        missing_triples,
    )
    threshold_list = [item["threshold"] for item in threshold_diagnostics]
    threshold, accepted_df = triple_filter.filter_best_threshold(
        model=None,
        candidates_df=scored_candidates_df.copy(),
        missing_df=missing_triples.copy(),
        train_df=pd.DataFrame(),
        threshold_list=threshold_list,
    )
    accepted_keys = set(
        accepted_df[["Head", "Relation", "Tail"]].astype(str).itertuples(index=False, name=None)
    )
    scored_keys = scored_candidates_df[["Head", "Relation", "Tail"]].astype(str).itertuples(index=False, name=None)
    rejected_mask = [key not in accepted_keys for key in scored_keys]
    rejected_df = scored_candidates_df[rejected_mask].reset_index(drop=True)
    accepted_full_df = scored_candidates_df[~pd.Series(rejected_mask)].reset_index(drop=True)

    return {
        "metadata": {
            "model_name": "TransE",
            "embedding_dim": embedding_dim,
            "optimizer": train_model.OPTIMIZER,
            "learning_rate": train_model.OPTIMIZER_KWARGS.get("lr"),
            "epochs": num_epochs,
            "device": train_model.resolve_device(preferred_device),
            "fallback": False,
        },
        "threshold": float(threshold),
        "threshold_diagnostics": threshold_diagnostics,
        "scored_candidates_df": scored_candidates_df.reset_index(drop=True),
        "accepted_df": accepted_full_df,
        "rejected_df": rejected_df,
    }
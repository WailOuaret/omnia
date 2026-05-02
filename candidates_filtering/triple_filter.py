import pandas as pd

try:
    from candidates_filtering.embedding.get_emb_transe import get_list_dist
except ModuleNotFoundError:
    get_list_dist = None


TRIPLE_COLUMNS = ["Head", "Relation", "Tail"]


def _triple_keys(df: pd.DataFrame) -> set[tuple[str, str, str]]:
    if df.empty:
        return set()
    return set(
        df[TRIPLE_COLUMNS]
        .astype(str)
        .itertuples(index=False, name=None)
    )

def filter_candidates(candidates_df:pd.DataFrame, threshold:float) -> pd.DataFrame:
    """
    Filter out candidates below a certain threshold
    """
    candidates_sample_df = candidates_df[candidates_df['distance']<threshold]
    candidates_sample_df = candidates_sample_df[TRIPLE_COLUMNS]
    return candidates_sample_df

def compute_coverage(filtred_df :pd.DataFrame, missing_df:pd.DataFrame) -> float:
    """
    Compute how much of the missing data we are able to recover from the filtred candidates
    """
    if len(missing_df) == 0:
        return 0.0
    recovered = _triple_keys(filtred_df) & _triple_keys(missing_df)
    return len(recovered) / len(missing_df)


def get_threshold_diagnostics(
    candidates_df: pd.DataFrame,
    missing_df: pd.DataFrame,
    threshold_list: list | None = None,
) -> list[dict]:
    """
    Evaluate candidate count reduction and missing-triple coverage per threshold.
    """
    if candidates_df.empty:
        return []
    if threshold_list is None:
        if "distance" not in candidates_df.columns:
            raise ValueError("candidates_df must contain a distance column when threshold_list is omitted.")
        distances = candidates_df["distance"].astype(float)
        std_dist = distances.std()
        if pd.isna(std_dist):
            std_dist = 0.0
        mean_dist = distances.mean()
        threshold_list = [
            mean_dist - std_dist,
            mean_dist - 0.5 * std_dist,
            mean_dist,
            mean_dist + 0.5 * std_dist,
            mean_dist + std_dist,
        ]

    total_candidates = len(candidates_df)
    total_missing = len(missing_df)
    missing_keys = _triple_keys(missing_df)
    diagnostics: list[dict] = []
    for threshold in threshold_list:
        filtered_df = filter_candidates(candidates_df, float(threshold))
        accepted_count = len(filtered_df)
        recovered_keys = _triple_keys(filtered_df) & missing_keys
        true_positive_count = len(recovered_keys)
        coverage = true_positive_count / total_missing if total_missing else 0.0
        reduction_ratio = accepted_count / total_candidates if total_candidates else 0.0
        precision = true_positive_count / accepted_count if accepted_count else 0.0
        score = (1 - reduction_ratio) * coverage
        diagnostics.append(
            {
                "threshold": float(threshold),
                "accepted_count": int(accepted_count),
                "rejected_count": int(total_candidates - accepted_count),
                "true_positive_count": int(true_positive_count),
                "coverage": float(coverage),
                "reduction_ratio": float(reduction_ratio),
                "precision": float(precision),
                "score": float(score),
            }
        )
    return diagnostics

def filter_best_threshold(model, candidates_df:pd.DataFrame, missing_df:pd.DataFrame,
                          train_df:pd.DataFrame, threshold_list:list = None) -> pd.DataFrame:
    """
    Compute the best threshold out of a list of threshold for a model.
    Return the best threshold and the filtred triples.
    """
    # default threshold list based on mean distance
    if threshold_list == None:
        if get_list_dist is None:
            raise ModuleNotFoundError(
                "PyKEEN is required to compute TransE distances automatically. "
                "Pass an explicit threshold_list with a precomputed distance column "
                "for lightweight smoke tests."
            )
        list_dist = get_list_dist(candidates_df, model.model, train_df)
        candidates_df['distance'] = list_dist
        mean_dist = candidates_df['distance'].mean()
        std_dist = candidates_df['distance'].std()
        threshold_list = [mean_dist- std_dist, mean_dist-0.5*std_dist,mean_dist,
                        mean_dist+0.5*std_dist,mean_dist + std_dist]

    diagnostics = get_threshold_diagnostics(candidates_df, missing_df, threshold_list)
    if not diagnostics:
        threshold = float(threshold_list[0]) if threshold_list else 0.0
        return threshold, candidates_df.iloc[0:0][TRIPLE_COLUMNS].copy()
    best = max(
        diagnostics,
        key=lambda item: (item["score"], item["coverage"], -item["reduction_ratio"]),
    )
    threshold = best["threshold"]
    filtred_df = filter_candidates(candidates_df, threshold)
    return threshold, filtred_df
    

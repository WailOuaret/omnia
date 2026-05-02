def parse_score(text: str | None) -> int:
    score = extract_score(text or "")
    if score in {"1", "0", "-1"}:
        return int(score)
    return -1


def _safe_div(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def clean_score(list_score) -> list[float]:
    list_score = [extract_score(score or "") for score in list_score]
    list_score = [str(item).rstrip('.') if str(item).endswith('.') else str(item) for item in list_score]
    list_score = [0 if item == '' else item for item in list_score]
    score_bin = [1 if item == '1' else 0 for item in list_score]
    return score_bin


def extract_score(text:str)->str:
    # Function to extract score
    # Find the starting index of "Score: "
    start_index = text.find("Score: ") + len("Score: ")

    # Find the end of the number, which could be marked by a non-digit character
    end_index = start_index
    while end_index < len(text) and (text[end_index].isdigit() or text[end_index] == '.'):
        end_index += 1

    # Extract and return the number using slicing
    return text[start_index:end_index]

def compute_score(prediction, ground_truth):
    pairs = [(int(gt), int(pred)) for gt, pred in zip(ground_truth, prediction)]
    TN = sum(1 for gt, pred in pairs if gt == 0 and pred == 0)
    FN = sum(1 for gt, pred in pairs if gt == 1 and pred == 0)
    TP = sum(1 for gt, pred in pairs if gt == 1 and pred == 1)
    FP = sum(1 for gt, pred in pairs if gt == 0 and pred == 1)
    accuracy = _safe_div(TN + TP, TN + TP + FN + FP)
    f1_score = _safe_div(2 * TP, 2 * TP + FP + FN)
    recall = _safe_div(TP, TP + FN)
    precision = _safe_div(TP, TP + FP)
    return accuracy, f1_score, recall, precision

def get_gt_pred(df, score_list):
    prediction = clean_score(score_list)
    ground_truth = df['Missing']
    return prediction, ground_truth

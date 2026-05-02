from dataclasses import dataclass
import re
from typing import Any

import pandas as pd
import requests


@dataclass
class _SimpleDocument:
    page_content: str


class _SimpleRetriever:
    def __init__(self, rows: list[str], top_k: int = 2):
        self.rows = rows
        self.top_k = top_k

    @staticmethod
    def _tokens(value: str) -> set[str]:
        return set(re.findall(r"[a-z0-9_./:-]+", value.lower()))

    def invoke(self, query: str) -> list[_SimpleDocument]:
        query_tokens = self._tokens(query)
        ranked = sorted(
            self.rows,
            key=lambda row: len(query_tokens & self._tokens(row)),
            reverse=True,
        )
        return [_SimpleDocument(page_content=row) for row in ranked[: self.top_k]]

def create_retriever(file_path:str, top_k:int = 2):
    try:
        from langchain_community.document_loaders.csv_loader import CSVLoader
        from langchain_experimental.text_splitter import SemanticChunker
        from langchain_community.embeddings import HuggingFaceEmbeddings
        from langchain_community.vectorstores import FAISS

        loader = CSVLoader(file_path=file_path)
        docs = loader.load()
        embedder = HuggingFaceEmbeddings()
        text_splitter = SemanticChunker(embedder)
        documents = text_splitter.split_documents(docs)
        vector = FAISS.from_documents(documents, embedder)
        return vector.as_retriever(search_type="similarity", search_kwargs={"k": top_k})
    except ModuleNotFoundError:
        df = pd.read_csv(file_path)
        rows = [
            f"Head:{row['Head']}\t Relation:{row['Relation']}\t Tail:{row['Tail']}"
            for _, row in df.iterrows()
            if {"Head", "Relation", "Tail"}.issubset(df.columns)
        ]
        return _SimpleRetriever(rows, top_k=top_k)

def prompt_answer(prompt_template:str, **kwargs) -> str:
    prompt = prompt_template.format(**kwargs)
    response = requests.post(
        "http://127.0.0.1:11434/api/generate",
        json={"model": kwargs.get("model_name", "mistral"), "prompt": prompt, "stream": False, "options": {"temperature": 0.1}},
        timeout=120,
    )
    response.raise_for_status()
    return str(response.json().get("response", ""))

def get_triple_sentence(triple):
    head = triple['Head']
    relation = triple['Relation']
    tail = triple['Tail']
    triple_sentence = f"Head:{head}\t Relation:{relation}\t Tail:{tail}"
    return triple_sentence

def get_triple_list(df):
    triple_list = []
    for item in df.iterrows():
        triple = item[1]
        triple_sentence = get_triple_sentence(triple)
        triple_list.append(triple_sentence)
    return triple_list

def plain_triple(df:pd.DataFrame):
    template = """
    1. Evaluate if the triple represent a correct fact or not.\n
    2. Is the triple correct: answer "1" if it is correct and "0" otherwise.\n
    3. If you don't know the answer, just say that "-1"\n
    4. Start the answer with 'Score:'\n
    5. A triple represent a relation between the head entity and the tail entity\n
    Triple: {triple}
    Helpful Answer:"""

    triple_list = get_triple_list(df)

    score_list = []
    for index,triple in enumerate(triple_list):
        score = prompt_answer(template, triple=triple)
        score_list.append(score)
        if index%100 == 0:
            print(f'{index} / {len(triple_list)}')
    return score_list

def context_triple(evaluation_df:pd.DataFrame, original_df:pd.DataFrame):
    template = """
    1. Use the following pieces of context to determine if the final triple present correct fact or not.\n
    2. Is the triple correct: answer "1" if it is correct and "0" otherwise.\n
    3. If you don't know the answer, just say that "-1"\n
    4. Start the answer with 'Score:'\n
    5. A triple represent a relation between the head entity and the tail entity\n

    Here similar triples to help you make a decision:
    Context: {context}
    Here the triple to evaluate:
    Triple: {triple}

    Helpful Answer:"""
    context_list =  []
    triple_list = []
    for item in evaluation_df.iterrows():
        context_triple = []
        triple = item[1]
        head = triple['Head']
        relation = triple['Relation']
        tail = triple['Tail']
        triple_sentence = f"Head:{head}\t Relation:{relation}\t Tail:{tail}"
        context_triple.append(original_df[original_df['Head'] == head].sample(1))
        context_triple.append(original_df[original_df['Relation'] == relation].sample(1))
        context_triple.append(original_df[original_df['Tail'] == tail].sample(1))
        context_list.append(context_triple)
        triple_list.append(triple_sentence)

    score_list = []
    for index, triple in enumerate(triple_list):
        context = context_list[index]
        score = prompt_answer(template, triple=triple, context=context)
        score_list.append(score)
        if index%100 == 0:
            print(f'{index} / {len(triple_list)}')
    return score_list

def RAG_triple(df:pd.DataFrame, retriever):
    template = """
    1. Use the following pieces of context to determine if the final triple present correct fact or not.\n
    2. Is the triple correct: answer "1" if it is correct and "0" otherwise.\n
    3. If you don't know the answer, just say that "-1"\n
    4. Start the answer with 'Score:'\n
    5. A triple represent a relation between the head entity and the tail entity\n

    Here similar triples to help you make a decision:
    Context: {context}
    Here the triple to evaluate:
    Triple: {triple}

    Helpful Answer:"""

    def get_context_list(triple):
        new_context_list = []
        context_list =  retriever.invoke(triple)
        for context in context_list:
            context = context.page_content
            new_context_list.append(context)
        return new_context_list
    
    triple_list = get_triple_list(df)
    score_list = []
    for index, triple in enumerate(triple_list):
        context = get_context_list(triple)
        score = prompt_answer(template, triple=triple, context=context)
        score_list.append(score)
        if index%100 == 0:
            print(f'{index} / {len(triple_list)}')

    return score_list

def triple2sentence(triple):
    template = """
    1. Your job is only to translate triple into sentence, no matter if it is correct or not
    2. A triple is two entities (head and tail) linked by a relation
    3. Transform the following triples into a sentence: '{triple}'
    4. If the triple present incorrect fact, still translate this as it is
    5. Do not make negative sentence 
    Answer: Give the sentence."""

    sentence = prompt_answer(template, triple=triple)
    return sentence

def get_sentence_list(df):
    sentence_list = []
    for item in df.iterrows():
        triple = item[1]
        triple_sentence = get_triple_sentence(triple)
        sentence = triple2sentence(triple_sentence)
        sentence_list.append(sentence)
    return sentence_list

def plain_sentence(df:pd.DataFrame):
    template = """
    1. Evaluate if the sentence represent a correct fact or not.\n
    2. Is the triple correct: answer "1" if it is correct and "0" otherwise.\n
    3. If you don't know the answer, just say that "-1"\n
    4. Start the answer with 'Score:'\n

    Sentence: {sentence}

    Helpful Answer:"""
    sentence_list = get_sentence_list(df)
    score_list = []
    for index, sentence in enumerate(sentence_list):
        score = prompt_answer(template, sentence=sentence)
        score_list.append(score)
        if index%100 == 0:
            print(f'{index} / {len(sentence_list)}')
    return score_list

def RAG_sentence(df, retriever):
    template = """
    1. Use the following pieces of context to determine if the sentence represent correct fact or not.\n
    2. Is the sentence stating correct facts: answer "1" if it is correct and "0" otherwise.\n
    3. If you don't know the answer, just say that "-1"\n
    4. Start the answer with 'Score:'\n

    Context: {context}

    Sentence: {sentence}

    Helpful Answer:"""

    def get_context_list(sentence):
        new_context_list = []
        context_list =  retriever.invoke(sentence)
        for context in context_list:
            context = context.page_content
            context = triple2sentence(context)
            new_context_list.append(context)
        return new_context_list

    sentence_list = get_sentence_list(df)
    score_list = []
    for index, sentence in enumerate(sentence_list):
        context = get_context_list(sentence)
        score = prompt_answer(template, sentence=sentence, context=context)
        score_list.append(score)
        if index%100 == 0:
            print(f'{index} / {len(sentence_list)}')
    return score_list

def context_sentence(evaluation_df:pd.DataFrame, original_df:pd.DataFrame):
    template = """
    1. Use the following pieces of context to determine if the sentence represent correct fact or not.\n
    2. Is the sentence stating correct facts: answer "1" if it is correct and "0" otherwise.\n
    3. If you don't know the answer, just say that "-1"\n
    4. Start the answer with 'Score:'\n

    Context: {context}

    Sentence: {sentence}

    Helpful Answer:"""
    context_list = []
    for item in evaluation_df.iterrows():
        context_triple = []
        triple = item[1]
        head = triple['Head']
        relation = triple['Relation']
        tail = triple['Tail']
        head_cont = original_df[original_df['Head'] == head].sample(1)
        for id, elem in head_cont.iterrows():
            elem_sent = triple2sentence(elem)
            context_list.append(elem_sent)
        rel_cont = original_df[original_df['Relation'] == relation].sample(1)
        for id, elem in rel_cont.iterrows():
            elem_sent = triple2sentence(elem)
            context_list.append(elem_sent)
        tail_cont = original_df[original_df['Tail'] == tail].sample(1)
        for id, elem in tail_cont.iterrows():
            elem_sent = triple2sentence(elem)
            context_list.append(elem_sent)

    sentence_list = get_sentence_list(evaluation_df)
    score_list = []
    for index, sentence in enumerate(sentence_list):
        context = context_list[index]
        score = prompt_answer(template, sentence=sentence, context=context)
        score_list.append(score)
        if index%100 == 0:
            print(f'{index} / {len(sentence_list)}')
    return score_list


def parse_score(text: str | None) -> int:
    match = re.search(r"Score:\s*(-?1|0)", text or "", flags=re.IGNORECASE)
    if not match:
        return -1
    return int(match.group(1))


def _decision_from_score(score: int) -> str:
    if score == 1:
        return "accepted"
    if score == 0:
        return "rejected"
    return "unresolved"


def _triple_text(row: pd.Series) -> str:
    return f"Head:{row['Head']}\t Relation:{row['Relation']}\t Tail:{row['Tail']}"


def _sentence_text(row: pd.Series) -> str:
    relation = str(row["Relation"]).replace("_", " ").replace("/", " ").replace(".", " ").strip()
    return f"{row['Head']} {relation} {row['Tail']}."


def _context_from_original(row: pd.Series, original_df: pd.DataFrame | None, limit: int = 3) -> list[str]:
    if original_df is None or original_df.empty:
        return []
    context_frames = []
    for column in ("Head", "Relation", "Tail"):
        matches = original_df[original_df[column].astype(str) == str(row[column])]
        if not matches.empty:
            context_frames.append(matches.head(1))
    if not context_frames:
        return []
    context_df = pd.concat(context_frames, ignore_index=True).drop_duplicates().head(limit)
    return [_triple_text(context_row) for _, context_row in context_df.iterrows()]


def _context_from_retriever(query: str, retriever: Any | None) -> list[str]:
    if retriever is None:
        return []
    documents = retriever.invoke(query)
    return [str(getattr(document, "page_content", document)) for document in documents]


def _build_triple_prompt(row: pd.Series, strategy: str, context: list[str]) -> str:
    context_text = "\n".join(context) if context else "No additional context."
    return (
        "Evaluate whether the candidate knowledge graph triple is correct.\n"
        "Return only one leading score line: Score: 1 for correct, Score: 0 for incorrect, "
        "or Score: -1 if unresolved.\n"
        f"Strategy: {strategy}\n"
        f"Context:\n{context_text}\n"
        f"Triple:\n{_triple_text(row)}"
    )


def _build_sentence_prompt(row: pd.Series, strategy: str, context: list[str]) -> str:
    context_text = "\n".join(context) if context else "No additional context."
    return (
        "Evaluate whether the candidate sentence states a correct fact.\n"
        "Return only one leading score line: Score: 1 for correct, Score: 0 for incorrect, "
        "or Score: -1 if unresolved.\n"
        f"Strategy: {strategy}\n"
        f"Context:\n{context_text}\n"
        f"Sentence:\n{_sentence_text(row)}"
    )


def mock_llm_response(row: pd.Series, *, context: list[str] | None = None) -> str:
    if "Missing" in row and pd.notna(row["Missing"]):
        score = 1 if int(row["Missing"]) == 1 else 0
    else:
        key = f"{row['Head']}|{row['Relation']}|{row['Tail']}"
        score = 1 if sum(ord(char) for char in key) % 3 == 0 else 0
    reason = "Matches held-out evaluation data." if score == 1 else "No supporting held-out signal found."
    if context:
        reason += f" Context rows inspected: {len(context)}."
    return f"Score: {score}\nReason: {reason}"


def _real_llm_response(prompt: str, model_name: str) -> str:
    response = requests.post(
        "http://127.0.0.1:11434/api/generate",
        json={"model": model_name, "prompt": prompt, "stream": False, "options": {"temperature": 0.1}},
        timeout=180,
    )
    response.raise_for_status()
    return str(response.json().get("response", ""))


def evaluate_candidates(
    evaluation_df: pd.DataFrame,
    *,
    original_df: pd.DataFrame | None = None,
    format_name: str = "triples",
    strategy: str = "rag",
    retriever: Any | None = None,
    top_k: int = 2,
    model_name: str = "mistral",
    mock: bool = False,
) -> pd.DataFrame:
    """Evaluate candidate triples and keep auditable prompt/response fields."""
    if evaluation_df.empty:
        return evaluation_df.copy()

    evaluated_rows: list[dict[str, Any]] = []
    for _, row in evaluation_df.reset_index(drop=True).iterrows():
        row_dict = row.to_dict()
        query = _triple_text(row)
        if strategy == "rag":
            context = _context_from_retriever(query, retriever)[:top_k]
        elif strategy == "context":
            context = _context_from_original(row, original_df, limit=max(top_k, 1))
        else:
            context = []

        if format_name == "sentences":
            prompt = _build_sentence_prompt(row, strategy, context)
            sentence = _sentence_text(row)
        else:
            prompt = _build_triple_prompt(row, strategy, context)
            sentence = None

        raw_response = mock_llm_response(row, context=context) if mock else _real_llm_response(prompt, model_name)
        parsed_score = parse_score(raw_response)
        row_dict.update(
            {
                "triple_text": query,
                "sentence_text": sentence,
                "retrieved_context": context,
                "prompt": prompt,
                "raw_response": raw_response,
                "parsed_score": parsed_score,
                "decision": _decision_from_score(parsed_score),
                "is_mock": bool(mock),
            }
        )
        evaluated_rows.append(row_dict)

    return pd.DataFrame(evaluated_rows)



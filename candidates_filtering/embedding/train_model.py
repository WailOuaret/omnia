import os
import sys
import pykeen
import torch
from pykeen.pipeline import pipeline
from pykeen.triples import TriplesFactory
import pandas as pd

RANDOM_SEED = 42
DEVICE = 'cpu'
OPTIMIZER = 'Adam'
OPTIMIZER_KWARGS = {"lr": 0.05}  # learning rate at 0.05
PROJECT_NAME = 'embedding'


def create_dataset(triples_df: pd.DataFrame) -> TriplesFactory:
    """
    Turn a pandas dataset with triples(head, relation, tail) into a TriplesFactory
    that can be used by pykeen.
    """
    dataset = TriplesFactory.from_labeled_triples(
        triples_df[["Head", "Relation", "Tail"]].values,
        create_inverse_triples=False,
        entity_to_id=None,
        relation_to_id=None,
        compact_id=True,
        filter_out_candidate_inverse_relations=True,
        metadata=None,
    )
    return dataset


def resolve_device(preferred_device: str | None = "cuda") -> str:
    if preferred_device and preferred_device.lower() == "cuda" and torch.cuda.is_available():
        return "cuda"
    return "cpu"


def create_pipeline(
    train_set: TriplesFactory,
    test_set: TriplesFactory,
    model_name: str,
    model_kwargs: dict,
    run_name: str,
    num_epochs: int = 50,
    preferred_device: str | None = "cuda",
    use_wandb: bool = False,
):
    """
    Create pipeline to train embedding model
    """
    resolved_device = resolve_device(preferred_device)
    if not use_wandb:
        os.environ.setdefault("WANDB_DISABLED", "true")

    train_pipeline = pipeline(
        training=train_set,
        testing=test_set,
        model=model_name,
        model_kwargs=model_kwargs,
        device=resolved_device,
        random_seed=RANDOM_SEED,
        optimizer=OPTIMIZER,
        optimizer_kwargs=OPTIMIZER_KWARGS,
        training_kwargs={
            "num_epochs": num_epochs,
        },
        result_tracker='wandb' if use_wandb else None,
        result_tracker_kwargs=(
            {
                "project": PROJECT_NAME,
            }
            if use_wandb
            else None
        ),
    )
    return train_pipeline

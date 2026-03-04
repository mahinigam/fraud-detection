"""
Central configuration for the Hybrid Fraud Detection Framework.
All paths, constants, hyperparameter search spaces, and device settings.
"""

import os
from pathlib import Path
import torch


# ─── Project Paths ──────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_RAW_IEEE = DATA_RAW / "ieee"
DATA_RAW_PAYSIM = DATA_RAW / "paysim"
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
OUTPUTS = PROJECT_ROOT / "outputs"

# Ensure output directories exist
DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
OUTPUTS.mkdir(parents=True, exist_ok=True)


# ─── Chronological Split ────────────────────────────────────────────────────
TRAIN_RATIO = 0.7


# ─── SMOTE Configuration ────────────────────────────────────────────────────
SMOTE_CONFIG = {
    "sampling_strategy": "auto",  # Resample minority to match majority
    "k_neighbors": 5,
    "random_state": 42,
}


# ─── SVM Subsampling ────────────────────────────────────────────────────────
SVM_SUBSAMPLE_SIZE = 50_000
SVM_N_FEATURES = 50           # Top features via LightGBM importance
SVM_NYSTROEM_COMPONENTS = 300  # Nystroem RBF kernel approximation components


# ─── Device Configuration ───────────────────────────────────────────────────
def get_device():
    """Auto-detect MPS (Apple Silicon) → CPU fallback."""
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")

DEVICE = get_device()


# ─── Autoencoder Configuration ──────────────────────────────────────────────
AUTOENCODER_CONFIG = {
    "hidden_dims": [128, 64, 32, 16, 32, 64, 128],
    "learning_rate": 1e-3,
    "batch_size": 512,
    "epochs": 50,
    "early_stopping_patience": 5,
    "dropout": 0.2,
}


# ─── Bayesian Optimization (Optuna) ─────────────────────────────────────────
OPTUNA_N_TRIALS = 50
OPTUNA_TIMEOUT = 3600  # 1 hour max per model

SEARCH_SPACES = {
    "logistic_regression": {
        "C": (1e-4, 1e2, "log"),
        "penalty": ["l1", "l2"],
        "solver": ["saga"],
        "max_iter": [1000],
    },
    "decision_tree": {
        "max_depth": (3, 30),
        "min_samples_split": (2, 50),
        "min_samples_leaf": (1, 20),
        "criterion": ["gini", "entropy"],
    },
    "random_forest": {
        "n_estimators": (100, 500),
        "max_depth": (5, 30),
        "min_samples_split": (2, 20),
        "min_samples_leaf": (1, 10),
        "max_features": ["sqrt", "log2"],
    },
    "hist_gradient_boosting": {
        "max_iter": (100, 500),
        "max_depth": (3, 10),
        "learning_rate": (0.01, 0.3, "log"),
        "min_samples_leaf": (5, 50),
        "max_leaf_nodes": (20, 100),
    },
    "xgboost": {
        "n_estimators": (100, 1000),
        "max_depth": (3, 10),
        "learning_rate": (0.01, 0.3, "log"),
        "subsample": (0.6, 1.0),
        "colsample_bytree": (0.6, 1.0),
        "reg_alpha": (1e-8, 10.0, "log"),
        "reg_lambda": (1e-8, 10.0, "log"),
        "min_child_weight": (1, 10),
    },
    "lightgbm": {
        "n_estimators": (100, 1000),
        "max_depth": (3, 12),
        "learning_rate": (0.01, 0.3, "log"),
        "num_leaves": (20, 150),
        "subsample": (0.6, 1.0),
        "colsample_bytree": (0.6, 1.0),
        "reg_alpha": (1e-8, 10.0, "log"),
        "reg_lambda": (1e-8, 10.0, "log"),
        "min_child_samples": (5, 100),
    },
    "catboost": {
        "iterations": (100, 1000),
        "depth": (4, 10),
        "learning_rate": (0.01, 0.3, "log"),
        "l2_leaf_reg": (1.0, 10.0),
        "bagging_temperature": (0.0, 1.0),
        "random_strength": (0.0, 10.0),
    },
    "svm": {
        "C": (0.1, 100.0, "log"),
        "gamma": (1e-4, 1.0, "log"),
    },
    "isolation_forest": {
        "n_estimators": (100, 500),
        "max_samples": (0.5, 1.0),
        "contamination": (0.001, 0.05, "log"),
        "max_features": (0.5, 1.0),
    },
}


# ─── Latency Benchmark ──────────────────────────────────────────────────────
MAX_INFERENCE_MS = 100
BENCHMARK_N_SAMPLES = 1000


# ─── Random Seed ─────────────────────────────────────────────────────────────
RANDOM_STATE = 42


# ─── Logging ─────────────────────────────────────────────────────────────────
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-25s │ %(levelname)-8s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)

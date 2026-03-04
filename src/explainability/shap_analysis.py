"""
SHAP-based Explainable AI (XAI).
Global: SHAP Summary Plots (top-20 feature importance)
Local: SHAP Force Plots for individual transaction forensics.
"""

import numpy as np
import shap
import matplotlib.pyplot as plt
from config.settings import OUTPUTS, get_logger

logger = get_logger(__name__)


def generate_shap_summary(
    model,
    X: np.ndarray,
    feature_names: list | None = None,
    model_name: str = "model",
    max_samples: int = 1000,
    y: np.ndarray | None = None,
) -> None:
    """
    Generate SHAP Summary Plot (global feature importance).

    Parameters
    ----------
    model : fitted model
    X : array-like
        Data to explain (use test set).
    feature_names : list, optional
    model_name : str
    max_samples : int
        Limit samples for SHAP computation speed.
    """
    logger.info(f"Generating SHAP summary for {model_name} ...")

    # Stratified subsample for speed
    if len(X) > max_samples:
        if y is not None:
            from sklearn.model_selection import train_test_split
            X_explain, _, _, _ = train_test_split(
                X, y, train_size=max_samples, stratify=y, random_state=42,
            )
        else:
            idx = np.random.RandomState(42).choice(len(X), max_samples, replace=False)
            X_explain = X[idx]
        logger.info(f"  SHAP subsampled to {len(X_explain):,} rows (from {len(X):,})")
    else:
        X_explain = X

    # Choose appropriate explainer
    try:
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_explain)

        # For binary classification, take class 1 values
        if isinstance(shap_values, list):
            shap_values = shap_values[1]

    except Exception:
        logger.info(f"  TreeExplainer failed for {model_name}, using KernelExplainer ...")
        background = shap.kmeans(X_explain, 50)
        explainer = shap.KernelExplainer(
            lambda x: model.predict_proba(x)[:, 1],
            background,
        )
        shap_values = explainer.shap_values(X_explain[:500])
        X_explain = X_explain[:500]

    # Summary plot (top 20 features)
    plt.figure(figsize=(12, 8))
    shap.summary_plot(
        shap_values,
        X_explain,
        feature_names=feature_names,
        max_display=20,
        show=False,
    )
    plt.title(f"SHAP Summary — {model_name}", fontsize=14, fontweight="bold")
    plt.tight_layout()

    save_path = OUTPUTS / f"shap_summary_{model_name}.png"
    plt.savefig(save_path, dpi=150, bbox_inches="tight")
    plt.close()
    logger.info(f"  SHAP summary saved to {save_path}")


def generate_shap_force_plot(
    model,
    X: np.ndarray,
    sample_indices: list[int],
    feature_names: list | None = None,
    model_name: str = "model",
) -> None:
    """
    Generate SHAP Force Plots for specific transactions (local forensics).

    Parameters
    ----------
    model : fitted model
    X : array-like
    sample_indices : list of int
        Indices of transactions to explain.
    feature_names : list, optional
    model_name : str
    """
    logger.info(
        f"Generating SHAP force plots for {len(sample_indices)} transactions ..."
    )

    try:
        explainer = shap.TreeExplainer(model)
    except Exception:
        bg_data = X[:min(500, len(X))]
        background = shap.kmeans(bg_data, 50)
        explainer = shap.KernelExplainer(
            lambda x: model.predict_proba(x)[:, 1],
            background,
        )

    for idx in sample_indices:
        sample = X[idx : idx + 1]
        shap_values = explainer.shap_values(sample)

        if isinstance(shap_values, list):
            shap_values = shap_values[1]

        # Generate force plot
        plt.figure(figsize=(16, 3))
        shap.force_plot(
            explainer.expected_value if not isinstance(explainer.expected_value, list)
            else explainer.expected_value[1],
            shap_values[0],
            sample[0],
            feature_names=feature_names,
            matplotlib=True,
            show=False,
        )
        plt.title(f"SHAP Force Plot — {model_name} — Transaction #{idx}")

        save_path = OUTPUTS / f"shap_force_{model_name}_txn{idx}.png"
        plt.savefig(save_path, dpi=150, bbox_inches="tight")
        plt.close()
        logger.info(f"  Force plot saved: {save_path}")


def explain_model(
    model,
    X_test: np.ndarray,
    y_test: np.ndarray | None = None,
    feature_names: list | None = None,
    model_name: str = "model",
    n_force_plots: int = 5,
) -> None:
    """
    Full XAI pipeline: summary plot + force plots for fraud transactions.

    Parameters
    ----------
    model : fitted model
    X_test : test features
    y_test : test labels (to select fraud transactions for force plots)
    feature_names : list
    model_name : str
    n_force_plots : int
        Number of force plots to generate.
    """
    # Global: Summary plot
    generate_shap_summary(model, X_test, feature_names, model_name, y=y_test)

    # Local: Force plots for fraud transactions
    if y_test is not None:
        fraud_indices = np.where(y_test == 1)[0]
        if len(fraud_indices) > n_force_plots:
            selected = np.random.choice(fraud_indices, n_force_plots, replace=False)
        else:
            selected = fraud_indices[:n_force_plots]

        if len(selected) > 0:
            generate_shap_force_plot(model, X_test, selected.tolist(), feature_names, model_name)
        else:
            logger.warning("No fraud transactions found for force plots.")

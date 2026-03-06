import argparse
import json
from pathlib import Path
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    precision_recall_curve,
    roc_curve,
    auc,
    confusion_matrix,
    ConfusionMatrixDisplay
)
from sklearn.calibration import calibration_curve

from config.settings import OUTPUTS

# Plot aesthetics
plt.style.use('seaborn-v0_8-whitegrid')
sns.set_context("paper", font_scale=1.5)
COLORS = sns.color_palette("Set2")

def load_data(dataset: str):
    """Load predictions and optimal thresholds."""
    preds_path = OUTPUTS / f"predictions_{dataset}.csv"
    thresh_path = OUTPUTS / f"thresholds_{dataset}.json"
    
    if not preds_path.exists() or not thresh_path.exists():
        raise FileNotFoundError(f"Run pipeline first. Missing files in {OUTPUTS}")

    df = pd.read_csv(preds_path)
    with open(thresh_path, "r") as f:
        thresholds = json.load(f)

    return df, thresholds

def plot_pr_curves(df, models, dataset):
    """Plot Precision-Recall curves for top models."""
    plt.figure(figsize=(10, 8))
    y_true = df["y_test"]

    for i, model in enumerate(models):
        if model not in df:
            continue
        y_prob = df[model]
        precision, recall, _ = precision_recall_curve(y_true, y_prob)
        pr_auc = auc(recall, precision)
        
        plt.plot(recall, precision, color=COLORS[i % len(COLORS)], lw=2,
                 label=f"{model} (AUC = {pr_auc:.4f})")

    # Baseline
    baseline = y_true.mean()
    plt.plot([0, 1], [baseline, baseline], linestyle='--', lw=2, color='gray',
             label=f'Random Baseline (PR={baseline:.3f})')

    plt.xlabel('Recall')
    plt.ylabel('Precision')
    plt.title(f'Precision-Recall Curve ({dataset.upper()})')
    plt.legend(loc="upper right")
    plt.tight_layout()
    plt.savefig(OUTPUTS / f"pr_curve_{dataset}.png", dpi=300)
    plt.close()

def plot_roc_curves(df, models, dataset):
    """Plot ROC curves for top models."""
    plt.figure(figsize=(10, 8))
    y_true = df["y_test"]

    for i, model in enumerate(models):
        if model not in df:
            continue
        y_prob = df[model]
        fpr, tpr, _ = roc_curve(y_true, y_prob)
        roc_auc = auc(fpr, tpr)
        
        plt.plot(fpr, tpr, color=COLORS[i % len(COLORS)], lw=2,
                 label=f"{model} (AUC = {roc_auc:.4f})")

    plt.plot([0, 1], [0, 1], color='gray', lw=2, linestyle='--', label='Random Classifier')
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title(f'Receiver Operating Characteristic ({dataset.upper()})')
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(OUTPUTS / f"roc_curve_{dataset}.png", dpi=300)
    plt.close()

def plot_threshold_optimization(df, model, threshold, dataset):
    """Plot F1 score against varying thresholds for the best model."""
    if model not in df:
        return
        
    plt.figure(figsize=(10, 6))
    y_true = df["y_test"]
    y_prob = df[model]

    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)
    
    # Calculate F1 score for each threshold
    f1_scores = 2 * (precision * recall) / (precision + recall + 1e-10)
    
    # thresholds array has 1 less element than precision/recall arrays
    plt.plot(thresholds, f1_scores[:-1], color='blue', lw=2, label='F1 Score')
    plt.axvline(x=threshold, color='red', linestyle='--', lw=2, 
                label=f'Optimal Threshold = {threshold:.3f}')
    
    plt.xlabel('Decision Threshold')
    plt.ylabel('F1 Score')
    plt.title(f'Threshold Optimization: {model} ({dataset.upper()})')
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(OUTPUTS / f"threshold_opt_{model}_{dataset}.png", dpi=300)
    plt.close()

def plot_confusion_matrix(df, model, threshold, dataset):
    """Plot Confusion Matrix for the given model operating at the optimized threshold."""
    if model not in df:
        return

    y_true = df["y_test"]
    y_pred = (df[model] >= threshold).astype(int)
    
    cm = confusion_matrix(y_true, y_pred)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, 
                                  display_labels=["Legitimate", "Fraud"])
    
    fig, ax = plt.subplots(figsize=(8, 6))
    disp.plot(cmap="Blues", values_format="d", ax=ax)
    plt.title(f'Confusion Matrix: {model} (t={threshold:.3f})\n{dataset.upper()}')
    plt.tight_layout()
    plt.savefig(OUTPUTS / f"cm_{model}_{dataset}.png", dpi=300)
    plt.close()

def plot_calibration_curves(df, models, dataset):
    """Plot reliability diagrams (calibration curves)."""
    plt.figure(figsize=(10, 8))
    y_true = df["y_test"]

    for i, model in enumerate(models):
        if model not in df:
            continue
        y_prob = df[model]
        prob_true, prob_pred = calibration_curve(y_true, y_prob, n_bins=10)
        
        plt.plot(prob_pred, prob_true, marker='o', lw=2, color=COLORS[i % len(COLORS)], label=model)

    plt.plot([0, 1], [0, 1], linestyle='--', color='gray', label='Perfectly Calibrated')
    plt.xlabel('Mean Predicted Probability')
    plt.ylabel('Fraction of Positives')
    plt.title(f'Calibration Curve ({dataset.upper()})')
    plt.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig(OUTPUTS / f"calibration_curve_{dataset}.png", dpi=300)
    plt.close()

def plot_ihs_improvement(dataset):
    """Plot bar chart comparing Pre-IHS to Post-IHS PR-AUC."""
    csv_path = OUTPUTS / f"ihs_comparison_{dataset}.csv"
    if not csv_path.exists():
        return
        
    df = pd.read_csv(csv_path)
    df = df.set_index("model")
    
    fig, ax = plt.subplots(figsize=(12, 6))
    x = np.arange(len(df))
    width = 0.35
    
    ax.bar(x - width/2, df["pre_pr_auc"], width, label='Pre-IHS', color=COLORS[0])
    ax.bar(x + width/2, df["post_pr_auc"], width, label='Post-IHS', color=COLORS[1])
    
    ax.set_ylabel('PR-AUC Score')
    ax.set_title(f'Imbalance Handling Strategy Lift ({dataset.upper()})')
    ax.set_xticks(x)
    ax.set_xticklabels(df.index, rotation=45, ha="right")
    ax.legend()
    
    plt.tight_layout()
    plt.savefig(OUTPUTS / f"ihs_impact_{dataset}.png", dpi=300)
    plt.close()

def main():
    parser = argparse.ArgumentParser(description="Generate Paper Figures from Results")
    parser.add_argument("--dataset", choices=["ieee", "paysim", "both"], default="ieee")
    args = parser.parse_args()

    datasets = ["ieee", "paysim"] if args.dataset == "both" else [args.dataset]
    
    # Models to plot for comparison
    models_to_plot = ["xgboost", "lightgbm", "catboost", "stacking_ensemble"]

    for ds in datasets:
        print(f"Generating figures for {ds.upper()}...")
        try:
            df, optimal_thresholds = load_data(ds)
        except Exception as e:
            print(f"Skipping {ds.upper()}: {e}")
            continue

        plot_pr_curves(df, models_to_plot, ds)
        plot_roc_curves(df, models_to_plot, ds)
        plot_calibration_curves(df, models_to_plot, ds)
        plot_ihs_improvement(ds)
        
        # Plot Threshold & CM for the best model (Stacking)
        best_model = "stacking_ensemble" if "stacking_ensemble" in df else "xgboost"
        best_t = optimal_thresholds.get(best_model, 0.5)
        
        plot_threshold_optimization(df, best_model, best_t, ds)
        plot_confusion_matrix(df, best_model, best_t, ds)
        
        print(f"Done! Figures saved in {OUTPUTS.absolute()}")

if __name__ == "__main__":
    main()

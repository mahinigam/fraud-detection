import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import json

from config.settings import OUTPUTS
from src.data.ieee_loader import load_ieee_cis, get_ieee_target_and_features
from src.data.paysim_loader import load_paysim, get_paysim_target_and_features
from src.data.splitter import chronological_split

plt.style.use('seaborn-v0_8-whitegrid')
sns.set_context("paper", font_scale=1.5)

def run_error_analysis(dataset: str):
    print(f"Running error analysis for {dataset}...")
    preds_path = OUTPUTS / f"predictions_{dataset}.csv"
    thresh_path = OUTPUTS / f"thresholds_{dataset}.json"
    
    if not preds_path.exists() or not thresh_path.exists():
        print(f"Missing predictions for {dataset}")
        return
        
    df_preds = pd.read_csv(preds_path)
    with open(thresh_path, "r") as f:
        thresholds = json.load(f)
        
    best_model = "stacking_ensemble" if "stacking_ensemble" in df_preds else "xgboost"
    threshold = thresholds.get(best_model, 0.5)
    
    if dataset == "ieee":
        df = load_ieee_cis(use_test=False)
        X, y = get_ieee_target_and_features(df)
        time_col = "TransactionDT"
        amount_col = "TransactionAmt"
    else:
        df = load_paysim()
        X, y = get_paysim_target_and_features(df)
        time_col = "step"
        amount_col = "amount"
        
    _, X_test, _, _ = chronological_split(X, y, temporal_col=time_col)
    
    # Align rows
    y_prob = df_preds[best_model].values
    y_pred = (y_prob >= threshold).astype(int)
    y_true = df_preds["y_test"].values
    
    # Identify FN and TP
    fn_mask = (y_true == 1) & (y_pred == 0)
    tp_mask = (y_true == 1) & (y_pred == 1)
    
    amounts_fn = X_test[amount_col].values[fn_mask]
    amounts_tp = X_test[amount_col].values[tp_mask]
    
    plt.figure(figsize=(10, 6))
    sns.kdeplot(np.log1p(amounts_fn), label="False Negatives (Missed Fraud)", fill=True, color="red")
    sns.kdeplot(np.log1p(amounts_tp), label="True Positives (Caught Fraud)", fill=True, color="green")
    plt.xlabel('Log Transaction Amount')
    plt.ylabel('Density')
    plt.title(f'Error Analysis: Transaction Amount Distribution ({dataset.upper()})')
    plt.legend()
    plt.tight_layout()
    plt.savefig(OUTPUTS / f"error_analysis_amount_{dataset}.png", dpi=300)
    plt.close()
    print(f"Error analysis plot saved for {dataset}")

if __name__ == "__main__":
    for ds in ["ieee", "paysim"]:
        run_error_analysis(ds)

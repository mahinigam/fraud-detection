#!/usr/bin/env python3
"""
Cost-Benefit Analysis for Fraud Detection Models.
Calculates explicit false-positive cost and net business savings.
"""

import pandas as pd
import json
import argparse
from pathlib import Path
import numpy as np

from src.ihs.threshold import find_optimal_threshold

def run_cost_analysis(dataset: str, avg_fraud_value: float, fp_cost: float):
    """
    Computes business metrics based on optimized thresholds.
    """
    outputs_dir = Path("outputs")
    preds_file = outputs_dir / f"predictions_{dataset}.csv"
    preds_zip_file = outputs_dir / f"predictions_{dataset}.csv.zip"
    
    if not preds_file.exists() and not preds_zip_file.exists():
        print(f"Error: Missing prediction files for {dataset}")
        print(f"Run the pipeline for {dataset} first.")
        return

    if preds_file.exists():
        df = pd.read_csv(preds_file)
    else:
        df = pd.read_csv(preds_zip_file)
        
    y_true = df["y_test"].values
    
    print("=" * 100)
    print(f"  COST-BENEFIT ANALYSIS — {dataset.upper()}")
    print("=" * 100)
    print(f"Assumptions:")
    print(f"  Average Fraud Txn Value: ₹{avg_fraud_value:,.2f}")
    print(f"  Cost of False Positive (Investigation/Churn): ₹{fp_cost:,.2f}")
    print("-" * 100)
    
    total_fraud_txns = np.sum(y_true == 1)
    max_possible_savings = total_fraud_txns * avg_fraud_value
    
    print(f"{'Model':<20} | {'Mode':<18} | {'Threshold':<9} | {'Net Savings (₹)':<15} | {'Fraud Caught':<12} | {'FP Cost':<10}")
    print("-" * 100)
    
    results = []
    
    for model in df.columns:
        if model == "y_test":
            continue
            
        y_prob = df[model].values
        
        # Calculate three different thresholds
        try:
            t_dict = find_optimal_threshold(y_true, y_prob, method="all", avg_fraud_value=avg_fraud_value, fp_cost=fp_cost)
        except Exception:
            continue
            
        modes = [
            ("F1-Optimal", t_dict["f1"]),
            ("Precision-Constrained", t_dict["precision_constrained"]),
            ("Business-Optimal", t_dict["business"])
        ]
        
        for mode_name, t in modes:
            y_pred = (y_prob >= t).astype(int)
            
            tp = np.sum((y_pred == 1) & (y_true == 1))
            fp = np.sum((y_pred == 1) & (y_true == 0))
            
            fraud_caught_value = tp * avg_fraud_value
            false_positive_cost = fp * fp_cost
            net_savings = fraud_caught_value - false_positive_cost
            
            results.append({
                "model": model,
                "mode": mode_name,
                "threshold": t,
                "net_savings": net_savings,
                "fraud_caught_value": fraud_caught_value,
                "false_positive_cost": false_positive_cost,
                "tp": tp,
                "fp": fp
            })
        
    # Sort by net savings
    results.sort(key=lambda x: x["net_savings"], reverse=True)
    
    # We will print the best result per model to avoid clutter, or just print the top 15 combinations
    for r in results[:15]:
        print(f"{r['model']:<20} | {r['mode']:<18} | {r['threshold']:<9.3f} | {r['net_savings']:>15,.2f} | {r['fraud_caught_value']:>12,.2f} | {r['false_positive_cost']:>10,.2f}")
        
    print("=" * 100)
    best = results[0]
    print(f"\nBusiness Recommendation:")
    print(f"Deploying {best['model']} using the {best['mode']} threshold ({best['threshold']:.3f}) yields maximum ROI.")
    print(f"At this threshold, we catch ₹{best['fraud_caught_value']:,.2f} in fraud but block legitimate transactions costing ₹{best['false_positive_cost']:,.2f} in friction.")
    print(f"Net savings: ₹{best['net_savings']:,.2f} ({(best['net_savings']/max_possible_savings)*100:.1f}% of total possible fraud losses).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run cost-benefit analysis")
    parser.add_argument("--dataset", choices=["ieee", "paysim"], default="paysim")
    parser.add_argument("--avg-fraud-value", type=float, default=5000.0, help="Average value of a fraud transaction (₹)")
    parser.add_argument("--fp-cost", type=float, default=50.0, help="Cost of a false positive (₹)")
    
    args = parser.parse_args()
    
    # Configure logger for threshold module to be less noisy here
    import logging
    logging.getLogger("src.ihs.threshold").setLevel(logging.WARNING)
    
    run_cost_analysis(args.dataset, args.avg_fraud_value, args.fp_cost)

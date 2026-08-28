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

def run_cost_analysis(dataset: str, avg_fraud_value: float, fp_cost: float):
    """
    Computes business metrics based on optimized thresholds.
    """
    outputs_dir = Path("outputs")
    preds_file = outputs_dir / f"predictions_{dataset}.csv"
    thresh_file = outputs_dir / f"thresholds_{dataset}.json"
    
    if not preds_file.exists() or not thresh_file.exists():
        print(f"Error: Missing prediction or threshold files for {dataset}")
        print(f"Run the pipeline for {dataset} first.")
        return

    df = pd.read_csv(preds_file)
    with open(thresh_file, "r") as f:
        thresholds = json.load(f)
        
    y_true = df["y_test"].values
    
    print("=" * 80)
    print(f"  COST-BENEFIT ANALYSIS — {dataset.upper()}")
    print("=" * 80)
    print(f"Assumptions:")
    print(f"  Average Fraud Txn Value: ₹{avg_fraud_value:,.2f}")
    print(f"  Cost of False Positive (Investigation/Churn): ₹{fp_cost:,.2f}")
    print("-" * 80)
    
    total_fraud_txns = np.sum(y_true == 1)
    max_possible_savings = total_fraud_txns * avg_fraud_value
    
    print(f"{'Model':<25} | {'Threshold':<9} | {'Net Savings (₹)':<15} | {'Fraud Caught':<12} | {'FP Cost':<10}")
    print("-" * 80)
    
    results = []
    
    for model in df.columns:
        if model == "y_test" or model not in thresholds:
            continue
            
        t = thresholds[model]
        y_prob = df[model].values
        y_pred = (y_prob >= t).astype(int)
        
        tp = np.sum((y_pred == 1) & (y_true == 1))
        fp = np.sum((y_pred == 1) & (y_true == 0))
        
        fraud_caught_value = tp * avg_fraud_value
        false_positive_cost = fp * fp_cost
        net_savings = fraud_caught_value - false_positive_cost
        
        results.append({
            "model": model,
            "threshold": t,
            "net_savings": net_savings,
            "fraud_caught_value": fraud_caught_value,
            "false_positive_cost": false_positive_cost
        })
        
    # Sort by net savings
    results.sort(key=lambda x: x["net_savings"], reverse=True)
    
    for r in results:
        print(f"{r['model']:<25} | {r['threshold']:<9.3f} | {r['net_savings']:>15,.2f} | {r['fraud_caught_value']:>12,.2f} | {r['false_positive_cost']:>10,.2f}")
        
    print("=" * 80)
    best = results[0]
    print(f"\nBusiness Recommendation:")
    print(f"Deploying {best['model']} at threshold {best['threshold']:.3f} yields maximum ROI.")
    print(f"At this threshold, we catch ₹{best['fraud_caught_value']:,.2f} in fraud but block legitimate transactions costing ₹{best['false_positive_cost']:,.2f} in friction/investigation.")
    print(f"Net savings: ₹{best['net_savings']:,.2f} ({(best['net_savings']/max_possible_savings)*100:.1f}% of total possible fraud losses).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run cost-benefit analysis")
    parser.add_argument("--dataset", choices=["ieee", "paysim"], default="paysim")
    parser.add_argument("--avg-fraud-value", type=float, default=5000.0, help="Average value of a fraud transaction (₹)")
    parser.add_argument("--fp-cost", type=float, default=50.0, help="Cost of a false positive (₹)")
    
    args = parser.parse_args()
    run_cost_analysis(args.dataset, args.avg_fraud_value, args.fp_cost)

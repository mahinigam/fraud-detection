import pandas as pd
import numpy as np
from pathlib import Path
import random

def generate_demo_data():
    np.random.seed(42)
    random.seed(42)
    
    print("Loading PaySim dataset...")
    # Load a small chunk to keep it fast, or load all and filter
    df = pd.read_csv("data/raw/paysim/paysim.csv", nrows=150000)
    
    # We want a specific merchant that will be the target of the abuse ring
    # In PaySim, merchants often start with 'M' in nameDest
    merchants = df[df['nameDest'].str.startswith('M', na=False)]['nameDest'].unique()
    target_merchant = "M1982863514"
    if target_merchant not in merchants:
        # If not in the first 150k rows, just force it on the most frequent one
        target_merchant = df['nameDest'].value_counts().index[0]
        
    print(f"Selected target merchant: {target_merchant}")
    
    # Synthesize device IDs for everyone based on nameOrig hash
    def generate_device(name):
        # A simple deterministic hash to a device pool
        h = hash(name) % 10000
        return f"DEV_{h:04d}"
        
    df['device_id'] = df['nameOrig'].apply(generate_device)
    
    # Let's inject an abuse ring!
    # We need a subset of customers transferring to the target merchant
    # that all share a small set of device IDs (e.g., 3 clusters).
    
    abuse_devices = ["DEV_RING_A", "DEV_RING_B", "DEV_RING_C"]
    
    # Find existing fraud transactions, or create synthetic ones 
    # to target this merchant. Since PaySim fraud is very rare, 
    # we'll synthetically alter 180 transactions to be fraudulent transfers to our target merchant.
    
    normal_indices = df[df['isFraud'] == 0].index
    fraud_injection_indices = np.random.choice(normal_indices, size=180, replace=False)
    
    df.loc[fraud_injection_indices, 'nameDest'] = target_merchant
    df.loc[fraud_injection_indices, 'isFraud'] = 1
    df.loc[fraud_injection_indices, 'type'] = 'TRANSFER'
    df.loc[fraud_injection_indices, 'amount'] = np.random.uniform(5000, 50000, size=180)
    
    # Assign the abuse ring devices to these fraudulent transactions
    ring_devices = np.random.choice(abuse_devices, size=180)
    df.loc[fraud_injection_indices, 'device_id'] = ring_devices
    
    # Add a baseline of normal transactions for this merchant (say, 12,000)
    # So we don't have a 100% fraud merchant
    normal_merchant_indices = np.random.choice(df.drop(fraud_injection_indices).index, size=12000, replace=False)
    df.loc[normal_merchant_indices, 'nameDest'] = target_merchant
    
    # Now slice the dataframe to ONLY include this merchant's transactions for the demo
    demo_df = df[df['nameDest'] == target_merchant].copy()
    
    print(f"Generated demo dataset with {len(demo_df)} transactions.")
    print(f"Fraud count: {demo_df['isFraud'].sum()}")
    print("Top devices:")
    print(demo_df['device_id'].value_counts().head(5))
    
    out_path = Path("data/raw/demo_transactions.csv")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    demo_df.to_csv(out_path, index=False)
    print(f"Saved to {out_path}")

if __name__ == "__main__":
    generate_demo_data()

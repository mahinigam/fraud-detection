import json
from pathlib import Path
from config.settings import OUTPUTS
import numpy as np

def generate_summary():
    summary = {}
    
    for dataset in ["ieee", "paysim"]:
        res_file = OUTPUTS / f"results_{dataset}.json"
        lat_file = OUTPUTS / f"latency_{dataset}.json"
        param_file = OUTPUTS / f"best_params_{dataset}.json"
        thresh_file = OUTPUTS / f"thresholds_{dataset}.json"
        
        if not res_file.exists():
            continue
            
        ds_summary = {}
        
        with open(res_file, "r") as f:
            results = json.load(f)
            
        # Best model by PR-AUC
        best_model = max(results.keys(), key=lambda k: results[k].get("pr_auc", 0))
        ds_summary["best_model_overall"] = best_model
        ds_summary["best_model_metrics"] = results[best_model]
        
        # Latency
        if lat_file.exists():
            with open(lat_file, "r") as f:
                latency_list = json.load(f)
            best_model_lat = next((item for item in latency_list if item.get("model") == best_model), {})
            ds_summary["latency"] = best_model_lat
            
        # Thresholds
        if thresh_file.exists():
            with open(thresh_file, "r") as f:
                thresholds = json.load(f)
            ds_summary["optimal_threshold"] = thresholds.get(best_model, 0.5)
            
        # Params
        if param_file.exists():
            with open(param_file, "r") as f:
                params = json.load(f)
            ds_summary["best_hyperparameters"] = params.get(best_model, {})
            
        summary[dataset] = ds_summary
        
    out_path = OUTPUTS / "results_summary.json"
    with open(out_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Summary generated at {out_path}")

if __name__ == "__main__":
    generate_summary()

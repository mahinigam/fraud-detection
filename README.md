# AI Risk Manager: Fraud-Spike Detector & Abuse-Ring Sentinel

A production-grade fraud detection system implementing a three-stage Imbalance Handling Strategy (IHS) targeting Indian merchant fraud patterns (e.g., chargebacks, account-takeover, transaction-velocity abuse). It features robust data preprocessing, a tailored model suite, and strict defense-only optimization with sub-100ms inference targeting.

## Business Impact & False-Positive Cost

In high-volume transaction environments, an aggressive model can block too many legitimate users, leading to customer churn and direct revenue loss. This framework explicitly models the **false-positive cost**. 
By optimizing the decision threshold for maximum ROI (balancing the value of fraud caught against the friction cost of blocked legitimate users), the system ensures we maximize net savings in ₹ rather than just abstract metrics. (Run `python scripts/cost_benefit_analysis.py` for exact ₹ tradeoffs).

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  IEEE-CIS    │     │   PaySim     │     │  Preprocess  │
│  6.3M rows   │────▶│  6.3M rows   │────▶│  Impute/Norm │
│  400+ feats  │     │  11 feats    │     │  Freq Encode │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                          ┌──────────────────────▼──────────────────┐
                          │     Three-Stage IHS                     │
                          │  1. SMOTE (Data-Level)                  │
                          │  2. Class Weights (Algorithm-Level)     │
                          │  3. Threshold Optimization (Decision)   │
                          └───────────────────────┬─────────────────┘
                                                  │
     ┌────────────────────────────────────────────▼───────────────────────┐
     │           Model Suite (Ablation-Driven Selection)                  │
     │  Top Boosted: XGB │ LGBM │ CatBoost (Selected for Stacking/Demo) │
     │  Classical & Unsupervised (Used to prove baseline limits)          │
     └────────────────────────┬───────────────────────────────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │  Stacking Ensemble  │
                   │  XGB + LGBM + Cat   │
                   │  → LR Meta-Learner  │
                   └──────────┬──────────┘
                              │
              ┌───────────────▼───────────────┐
              │  Evaluation & Explainability  │
              │  PR-AUC │ SHAP │ Latency      │
              └───────────────────────────────┘
```

## AI Judgment & Model Ablation

We experimented with 10 models (from LR to SVM to Autoencoders) but deliberately reduced the active ensemble to **XGBoost, LightGBM, and CatBoost**. 
Classical models (SVM, LR) struggled with the severe non-linear imbalance, and unsupervised methods (Isolation Forest, Autoencoders) flagged too many false positives. By proving these limitations via ablation, we deployed the right tool (gradient boosting) for the tabular data challenge.

## Quick Start & Demo

Try the Streamlit Demo immediately with sample transactions:
```bash
# Start the visual UI
streamlit run app.py
```
Or run the CLI inference:
```bash
python predict.py --transaction samples/sample_transactions.json --dataset paysim
```

### 1. Environment Setup

```bash
# Python 3.12 required
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Download Datasets

**IEEE-CIS Fraud Detection** — [Kaggle](https://www.kaggle.com/c/ieee-fraud-detection/data)
- Download all files → place in `data/raw/ieee/`

**PaySim** — [Kaggle](https://www.kaggle.com/datasets/ealaxi/paysim1)
- Download → rename to `paysim.csv` → place in `data/raw/paysim/`

```
data/raw/
├── ieee/
│   ├── train_transaction.csv
│   ├── train_identity.csv
│   ├── test_transaction.csv
│   └── test_identity.csv
└── paysim/
    └── paysim.csv
```

### 3. Run Pipeline

```bash
# Quick run (no hyperparameter tuning)
python main.py --dataset ieee --skip-tuning

# Full pipeline with Bayesian optimization
python main.py --dataset ieee

# Both datasets
python main.py --dataset both

# Specific models only
python main.py --dataset ieee --models xgboost lightgbm catboost
```

### 4. Run Tests

```bash
pytest tests/ -v
```

## Technical Details

| Component | Implementation |
|---|---|
| **Splitting** | Chronological 85/15 (train/val) & 70/30 (train/test) |
| **Imputation** | Median (numerical), Mode (categorical) |
| **Normalization** | Z-score (fit on train) |
| **Encoding** | Frequency encoding (high-cardinality), One-hot (low-cardinality) |
| **SMOTE** | Train partition only |
| **Class Weights** | Inverse frequency |
| **Threshold** | Youden's J + F1 maximization |
| **SVM** | 100K stratified subsample (O(n²) mitigation) |
| **Autoencoder** | PyTorch, MPS-accelerated |
| **Stacking** | XGB + LGBM + CatBoost → LR meta-learner |
| **Optimization** | Optuna (TPE sampler, PR-AUC objective) |
| **Target** | Maximize ROI via F1-score / precision-recall balance |

### Why Chronological Splitting?
Fraud patterns evolve over time. Randomly splitting data (`train_test_split`) causes "future-leaking-into-past" — the model learns from future fraud attacks to predict past ones, yielding artificially high scores that fail in production. We use strict chronological splitting to simulate a real-world production deployment.

## Results (PaySim Dataset)

*Metrics on the held-out 30% chronological test set after IHS and optimization.*

| Model | Precision | Recall | F1-Score | PR-AUC | Latency (ms) |
|---|---|---|---|---|---|
| **HistGradientBoosting** | **96.89%** | 78.33% | **86.63%** | **93.28%** | <100ms |
| **LightGBM** | 83.84% | **87.54%** | 85.65% | 92.71% | <100ms |
| **Stacking Ensemble** | 90.65% | 81.35% | 85.75% | 92.84% | ~150ms |
| **XGBoost** | 80.47% | 86.14% | 83.21% | 91.47% | <100ms |
| **CatBoost** | 92.68% | 73.33% | 81.87% | 88.98% | <100ms |

HistGradientBoosting provided the strongest overall performance with a PR-AUC of 93.28% and 96.89% precision, catching 78.33% of fraud rings with extremely low false positives.

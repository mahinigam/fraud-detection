# Hybrid Fraud Detection Framework

A production-grade fraud detection system implementing a three-stage Imbalance Handling Strategy (IHS) with 10 individual models, a stacking meta-learner, SHAP explainability, and sub-100ms inference targeting.

## Architecture

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
     │                        Model Suite (10 Models)                     │
     │  LR │ SVM-RBF │ DT │ RF │ GBM │ XGB │ LGBM │ CatBoost │ IF │ AE    │
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

## Quick Start

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
| **Splitting** | Chronological 70/30 (no shuffling) |
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
| **XAI** | SHAP summary + force plots |
| **Target** | PR-AUC primary, <100ms inference |

## Hardware Notes (M4 Mac)

- **MPS Acceleration**: Autoencoder auto-detects Apple Metal Performance Shaders
- **Parallel Inference**: Stacking ensemble uses ThreadPoolExecutor for base model predictions
- **SVM Optimization**: Stratified 100K subsample preserving fraud ratio

## Metrics

- **Primary**: PR-AUC (Precision-Recall Area Under Curve)
- **Secondary**: F1-score, MCC, Recall, ROC-AUC
- **IHS Targets**: 22-38% Recall lift, 18-31% F1 lift

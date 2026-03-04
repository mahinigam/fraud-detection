"""
Classical ML models: Logistic Regression, SVM (Nystroem-approximated RBF),
Decision Tree, Random Forest, HistGradientBoosting.

SVM Pipeline:
  1. 50K stratified subsample from original (pre-SMOTE) data
  2. Top-50 feature selection via LightGBM importance
  3. Nystroem RBF kernel approximation (300 components)
  4. SGDClassifier(loss='hinge') — linear SVM in the Nystroem feature space
"""

import numpy as np
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.kernel_approximation import Nystroem
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

from config.settings import (
    RANDOM_STATE, SVM_SUBSAMPLE_SIZE, SVM_N_FEATURES, SVM_NYSTROEM_COMPONENTS,
    get_logger,
)

logger = get_logger(__name__)


class NystroemSVM:
    """
    SVM-RBF approximation using Nystroem kernel + SGDClassifier.

    Pipeline:
    1. Select top-N features (indices provided externally)
    2. Nystroem RBF approximation → maps to n_components-dim space
    3. StandardScaler → SGDClassifier(loss='hinge')

    This achieves O(n × d) instead of O(n² × d), making it
    feasible on 50K+ samples.
    """

    def __init__(
        self,
        n_components: int = SVM_NYSTROEM_COMPONENTS,
        feature_indices: np.ndarray | None = None,
        class_weight: dict | str | None = "balanced",
    ):
        self.n_components = n_components
        self.feature_indices = feature_indices
        self.class_weight = class_weight

        self.pipeline = Pipeline([
            ("nystroem", Nystroem(
                kernel="rbf",
                n_components=n_components,
                random_state=RANDOM_STATE,
            )),
            ("scaler", StandardScaler()),
            ("sgd", SGDClassifier(
                loss="hinge",
                class_weight=class_weight,
                max_iter=1000,
                tol=1e-3,
                random_state=RANDOM_STATE,
                n_jobs=-1,
            )),
        ])
        self.classes_ = np.array([0, 1])

    def _select_features(self, X: np.ndarray) -> np.ndarray:
        """Select top features if indices are set."""
        if self.feature_indices is not None:
            return X[:, self.feature_indices]
        return X

    def fit(self, X: np.ndarray, y: np.ndarray):
        X_sel = self._select_features(X)
        logger.info(
            f"  NystroemSVM fitting: {X_sel.shape[0]:,} samples × "
            f"{X_sel.shape[1]} features → {self.n_components} Nystroem components"
        )
        self.pipeline.fit(X_sel, y)
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        X_sel = self._select_features(X)
        return self.pipeline.predict(X_sel)

    def decision_function(self, X: np.ndarray) -> np.ndarray:
        X_sel = self._select_features(X)
        return self.pipeline.decision_function(X_sel)

    def get_params(self, deep=True):
        return {
            "n_components": self.n_components,
            "class_weight": self.class_weight,
        }

    def set_params(self, **params):
        if "n_components" in params:
            self.n_components = params["n_components"]
        if "class_weight" in params:
            self.class_weight = params["class_weight"]
        return self


def select_top_features(
    feature_importances: np.ndarray,
    n_features: int = SVM_N_FEATURES,
) -> np.ndarray:
    """
    Select top-N feature indices from importance scores.

    Parameters
    ----------
    feature_importances : array of shape (n_features,)
        Feature importance scores (e.g., from LightGBM).
    n_features : int
        Number of top features to select.

    Returns
    -------
    np.ndarray
        Indices of top features, sorted by importance descending.
    """
    top_indices = np.argsort(feature_importances)[::-1][:n_features]
    total_importance = feature_importances[top_indices].sum() / feature_importances.sum()
    logger.info(
        f"Selected top-{n_features} features "
        f"(capturing {total_importance:.1%} of total importance)"
    )
    return top_indices


def _prepare_svm_data(X_original, y_original, n_samples=SVM_SUBSAMPLE_SIZE):
    """
    SVM-specific data prep: stratified subsample from ORIGINAL
    (pre-SMOTE) data. No SMOTE applied — SVM uses class_weight='balanced'
    instead to avoid overfitting on synthetic points.
    """
    if len(X_original) <= n_samples:
        logger.info(f"SVM: using full dataset ({len(X_original):,} samples)")
        return X_original.copy(), y_original.copy()

    X_sub, _, y_sub, _ = train_test_split(
        X_original, y_original,
        train_size=n_samples,
        stratify=y_original,
        random_state=RANDOM_STATE,
    )
    logger.info(
        f"SVM subsampled: {len(X_sub):,} from {len(X_original):,} "
        f"(fraud rate preserved: {np.mean(y_sub):.4%})"
    )
    return X_sub, y_sub


def build_classical_models(
    class_weights: dict | None = None,
    svm_feature_indices: np.ndarray | None = None,
) -> dict:
    """
    Build dictionary of classical model instances.

    Parameters
    ----------
    class_weights : dict, optional
        {0: w0, 1: w1} class weights for imbalanced learning.
    svm_feature_indices : np.ndarray, optional
        Top-N feature indices for SVM feature selection.

    Returns
    -------
    dict
        {model_name: model_instance}
    """
    models = {
        "logistic_regression": LogisticRegression(
            class_weight=class_weights,
            solver="saga",
            max_iter=1000,
            random_state=RANDOM_STATE,
        ),
        "svm_rbf": NystroemSVM(
            n_components=SVM_NYSTROEM_COMPONENTS,
            feature_indices=svm_feature_indices,
            class_weight="balanced",
        ),
        "decision_tree": DecisionTreeClassifier(
            class_weight=class_weights,
            random_state=RANDOM_STATE,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=100,
            class_weight=class_weights,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "hist_gradient_boosting": HistGradientBoostingClassifier(
            max_iter=200,
            random_state=RANDOM_STATE,
            class_weight="balanced",
        ),
    }
    return models


def train_classical_model(
    model,
    model_name: str,
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_original: np.ndarray | None = None,
    y_original: np.ndarray | None = None,
    sample_weight: np.ndarray | None = None,
) -> object:
    """
    Train a classical model.
    SVM uses pre-SMOTE subsampled data with Nystroem approximation.

    Parameters
    ----------
    model : sklearn estimator or NystroemSVM
    model_name : str
    X_train, y_train : SMOTE'd training arrays (for all models except SVM)
    X_original, y_original : Original pre-SMOTE data (for SVM subsampling)
    sample_weight : optional

    Returns
    -------
    Fitted model
    """
    if model_name == "svm_rbf":
        # SVM trains on subsampled ORIGINAL data (no SMOTE)
        if X_original is not None and y_original is not None:
            X_fit, y_fit = _prepare_svm_data(X_original, y_original)
        else:
            X_fit, y_fit = _prepare_svm_data(X_train, y_train)
        logger.info(f"Training {model_name} (Nystroem-approximated) on {len(X_fit):,} samples ...")
        model.fit(X_fit, y_fit)
    elif sample_weight is not None:
        logger.info(f"Training {model_name} with sample_weight ...")
        model.fit(X_train, y_train, sample_weight=sample_weight)
    else:
        logger.info(f"Training {model_name} on {len(X_train):,} samples ...")
        model.fit(X_train, y_train)

    logger.info(f"  {model_name} trained successfully.")
    return model

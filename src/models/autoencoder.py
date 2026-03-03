"""
PyTorch Autoencoder for anomaly-based fraud detection.
MPS (Apple Silicon Metal) accelerated with CPU fallback.
Trained on legitimate transactions — high reconstruction error = fraud.
"""

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from config.settings import AUTOENCODER_CONFIG, DEVICE, get_logger

logger = get_logger(__name__)


class FraudAutoencoder(nn.Module):
    """
    Symmetric autoencoder for anomaly detection.
    Architecture: Input → [128, 64, 32, 16] → [32, 64, 128] → Input
    """

    def __init__(self, input_dim: int, hidden_dims: list | None = None, dropout: float = 0.2):
        super().__init__()
        if hidden_dims is None:
            hidden_dims = AUTOENCODER_CONFIG["hidden_dims"]

        # Build encoder
        encoder_layers = []
        prev_dim = input_dim
        mid = len(hidden_dims) // 2 + 1
        for h_dim in hidden_dims[:mid]:
            encoder_layers.extend([
                nn.Linear(prev_dim, h_dim),
                nn.BatchNorm1d(h_dim),
                nn.ReLU(),
                nn.Dropout(dropout),
            ])
            prev_dim = h_dim
        self.encoder = nn.Sequential(*encoder_layers)

        # Build decoder
        decoder_layers = []
        for h_dim in hidden_dims[mid:]:
            decoder_layers.extend([
                nn.Linear(prev_dim, h_dim),
                nn.BatchNorm1d(h_dim),
                nn.ReLU(),
                nn.Dropout(dropout),
            ])
            prev_dim = h_dim
        decoder_layers.append(nn.Linear(prev_dim, input_dim))
        self.decoder = nn.Sequential(*decoder_layers)

    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded


class AutoencoderDetector:
    """
    Anomaly detector using reconstruction error.
    Train on legitimate transactions only.
    """

    def __init__(self, input_dim: int, device=DEVICE):
        self.device = device
        self.input_dim = input_dim
        self.model = FraudAutoencoder(
            input_dim=input_dim,
            hidden_dims=AUTOENCODER_CONFIG["hidden_dims"],
            dropout=AUTOENCODER_CONFIG["dropout"],
        ).to(self.device)
        self.optimizer = torch.optim.Adam(
            self.model.parameters(),
            lr=AUTOENCODER_CONFIG["learning_rate"],
        )
        self.criterion = nn.MSELoss()
        self.threshold_ = None
        self.classes_ = np.array([0, 1])

        logger.info(f"Autoencoder initialized on device: {self.device}")

    def fit(self, X_train: np.ndarray, y_train: np.ndarray = None):
        """
        Train on LEGITIMATE transactions only.
        If y_train is provided, filter to class 0.
        """
        if y_train is not None:
            mask = y_train == 0
            if isinstance(mask, np.ndarray):
                X_legit = X_train[mask]
            else:
                X_legit = X_train[mask.values]
            logger.info(
                f"Training autoencoder on {len(X_legit):,} legitimate transactions "
                f"(filtered from {len(X_train):,})"
            )
        else:
            X_legit = X_train

        dataset = TensorDataset(torch.FloatTensor(X_legit))
        dataloader = DataLoader(
            dataset,
            batch_size=AUTOENCODER_CONFIG["batch_size"],
            shuffle=True,
        )

        self.model.train()
        best_loss = float("inf")
        patience_counter = 0

        for epoch in range(AUTOENCODER_CONFIG["epochs"]):
            epoch_loss = 0.0
            for (batch,) in dataloader:
                batch = batch.to(self.device)
                self.optimizer.zero_grad()
                output = self.model(batch)
                loss = self.criterion(output, batch)
                loss.backward()
                self.optimizer.step()
                epoch_loss += loss.item() * len(batch)

            epoch_loss /= len(X_legit)

            if epoch_loss < best_loss:
                best_loss = epoch_loss
                patience_counter = 0
            else:
                patience_counter += 1

            if (epoch + 1) % 10 == 0:
                logger.info(f"  Epoch {epoch+1}/{AUTOENCODER_CONFIG['epochs']}: loss={epoch_loss:.6f}")

            if patience_counter >= AUTOENCODER_CONFIG["early_stopping_patience"]:
                logger.info(f"  Early stopping at epoch {epoch+1}")
                break

        # Compute threshold from training reconstruction errors
        self.model.eval()
        with torch.no_grad():
            X_tensor = torch.FloatTensor(X_legit).to(self.device)
            reconstructed = self.model(X_tensor).cpu().numpy()
            errors = np.mean((X_legit - reconstructed) ** 2, axis=1)
            self.threshold_ = np.percentile(errors, 95)
            logger.info(f"  Reconstruction error threshold (95th pctl): {self.threshold_:.6f}")

        return self

    def _compute_reconstruction_error(self, X: np.ndarray) -> np.ndarray:
        """Compute per-sample reconstruction error."""
        self.model.eval()
        with torch.no_grad():
            X_tensor = torch.FloatTensor(X).to(self.device)
            # Process in batches to avoid OOM
            batch_size = AUTOENCODER_CONFIG["batch_size"]
            errors = []
            for i in range(0, len(X), batch_size):
                batch = X_tensor[i : i + batch_size]
                reconstructed = self.model(batch)
                batch_errors = torch.mean((batch - reconstructed) ** 2, dim=1)
                errors.append(batch_errors.cpu().numpy())
            return np.concatenate(errors)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Convert reconstruction error to probability-like output.
        Higher error → higher fraud probability.
        """
        errors = self._compute_reconstruction_error(X)

        # Sigmoid transformation centered on threshold
        if self.threshold_ is not None and self.threshold_ > 0:
            proba_fraud = 1 / (1 + np.exp(-(errors - self.threshold_) / (self.threshold_ * 0.5)))
        else:
            # Fallback: min-max normalize
            min_e, max_e = errors.min(), errors.max()
            if max_e - min_e == 0:
                proba_fraud = np.zeros(len(errors))
            else:
                proba_fraud = (errors - min_e) / (max_e - min_e)

        proba_legit = 1 - proba_fraud
        return np.column_stack([proba_legit, proba_fraud])

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Binary prediction using threshold."""
        errors = self._compute_reconstruction_error(X)
        return (errors > self.threshold_).astype(int)

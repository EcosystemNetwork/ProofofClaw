/**
 * Proof of Claw — Shared Wallet Functions
 * Common wallet connection UI handling for all pages
 */

// Wallet state
let walletState = { connected: false, address: null };

/**
 * Connect wallet UI handler
 */
async function connectWalletUI() {
  if (!window.PocViem) {
    alert('Wallet module loading... Please try again in a moment.');
    return;
  }

  const btn = document.getElementById('wallet-connect-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Connecting...';
  }

  try {
    const { address } = await window.PocViem.connectWallet();
    updateWalletUI(address);
    // Store connection in localStorage for cross-page persistence
    localStorage.setItem('poc_wallet_connected', 'true');
    localStorage.setItem('poc_wallet_address', address);
    // Sync to Neon DB if PocPersist is available
    if (typeof PocPersist !== 'undefined') {
      PocPersist.setWallet(address);
      PocPersist.fullSync().catch(() => {});
    }
  } catch (e) {
    alert('Wallet connection failed: ' + e.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Connect Wallet';
    }
  }
}

/**
 * Update wallet UI after connection
 */
function updateWalletUI(address) {
  walletState = { connected: true, address };

  const btn = document.getElementById('wallet-connect-btn');
  const display = document.getElementById('wallet-display');
  const addressEl = document.getElementById('wallet-address');

  if (btn) btn.style.display = 'none';
  if (display) display.style.display = 'flex';
  if (addressEl) {
    const formatted = (window.PocViem && window.PocViem.formatAddress)
      ? window.PocViem.formatAddress(address)
      : address.slice(0, 6) + '...' + address.slice(-4);
    addressEl.textContent = formatted;
    // Force readable cyan text — the topbar background makes text-secondary invisible
    addressEl.style.color = 'var(--cyan)';
    addressEl.style.fontFamily = 'var(--font-mono)';
    addressEl.style.fontSize = '12px';
  }
}

/**
 * Disconnect wallet
 */
function disconnectWalletUI() {
  walletState = { connected: false, address: null };
  localStorage.removeItem('poc_wallet_connected');
  localStorage.removeItem('poc_wallet_address');
  if (typeof PocPersist !== 'undefined') PocPersist.setWallet(null);

  if (window.PocViem) window.PocViem.disconnectWallet();

  const btn = document.getElementById('wallet-connect-btn');
  const display = document.getElementById('wallet-display');

  if (btn) {
    btn.style.display = '';
    btn.textContent = 'Connect Wallet';
    btn.disabled = false;
  }
  if (display) display.style.display = 'none';
}

/**
 * Check for existing wallet connection — silently reconnects without user prompt.
 * Uses eth_accounts (no popup) to verify wallet is still authorized, then
 * re-initializes the viem wallet client so cross-page state is restored.
 */
async function checkWalletConnection() {
  if (!window.PocViem) {
    setTimeout(checkWalletConnection, 500);
    return;
  }

  const walletConnected = localStorage.getItem('poc_wallet_connected');
  const storedAddress   = localStorage.getItem('poc_wallet_address');

  if (!walletConnected) return;

  // ── Ledger: address already known, just restore the display ──────────────
  // We don't re-query the device (it may not be plugged in between pages).
  // The topbar shows the last confirmed Ledger address.
  if (walletConnected === 'ledger') {
    if (storedAddress) {
      updateWalletUI(storedAddress);
    }
    return;
  }

  // ── Browser wallet (MetaMask / WalletConnect / etc.) ─────────────────────
  try {
    // eth_accounts does NOT pop a permission dialog — safe to call on every load
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        // Re-initialize the viem wallet client silently (connectWallet calls eth_requestAccounts
        // which returns immediately when already authorized, no dialog shown)
        await window.PocViem.connectWallet();
        const state = window.PocViem.getWalletState();
        if (state.connected) {
          updateWalletUI(state.address);
          // Update stored address in case it changed (e.g. account switch)
          localStorage.setItem('poc_wallet_address', state.address);
          // Sync to Neon DB if available
          if (typeof PocPersist !== 'undefined') {
            PocPersist.setWallet(state.address);
          }
          return;
        }
      }
    }

    // Wallet is no longer authorized — clear stale state but don't show error
    localStorage.removeItem('poc_wallet_connected');
    localStorage.removeItem('poc_wallet_address');
  } catch (e) {
    // Silent fail — wallet may not be available (e.g. non-web3 browser)
    localStorage.removeItem('poc_wallet_connected');
    localStorage.removeItem('poc_wallet_address');
  }
}

/**
 * Get current wallet state
 */
function getWalletState() {
  return walletState;
}

// Auto-check wallet connection on load
document.addEventListener('DOMContentLoaded', checkWalletConnection);

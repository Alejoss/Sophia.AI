const STORAGE_KEY = 'sophia.fundingWallet';

export function readFundingWallet() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function rememberFundingWallet(address) {
  try {
    if (address) {
      sessionStorage.setItem(STORAGE_KEY, address);
    }
  } catch {
    // The campaign page still works if the browser blocks storage.
  }
}

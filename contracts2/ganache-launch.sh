#!/bin/bash
BASE="$(dirname "$0")"
mkdir -p $BASE/local/db
ganache-cli --wallet.mnemonic "dentist whale pattern drastic time black cigar bike person destroy punch hungry" --wallet.totalAccounts 100 --wallet.defaultBalance 1000 --db "$BASE/local/db"

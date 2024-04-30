#!/bin/bash
BASE="$(dirname "$0")"
mkdir -p $BASE/local/db
ganache-cli --mnemonic "dentist whale pattern drastic time black cigar bike person destroy punch hungry" --accounts 100 --defaultBalanceEther 1000 --db "$BASE/local/db"

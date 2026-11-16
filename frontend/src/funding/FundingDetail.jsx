import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useWizardConnect, WizardConnectQRDialog } from '@wizardconnect/react';
import pathFundingApi from '../api/pathFundingApi';
import { getUserFromLocalStorage } from '../context/localStorageUtils';
import {
  addressFromPublicKey,
  claimTx,
  openCampaignTx,
  pledgeTx,
  refundTx,
} from './buildCampaignTx';
import { rememberFundingWallet } from './fundingWallet';

const FundingDetail = () => {
  const { t } = useTranslation('paths');
  const { proposalId } = useParams();
  const [proposal, setProposal] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [amount, setAmount] = useState('10000');
  const [txid, setTxid] = useState('');
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState(null);
  const wizard = useWizardConnect({ dappName: 'Sophia' });
  const user = getUserFromLocalStorage();

  const reload = () => pathFundingApi.getProposal(proposalId).then(setProposal);

  useEffect(() => {
    reload().catch(() => setError(t('funding.loadError')));
  }, [proposalId, t]);

  useEffect(() => {
    if (!wizard.manager || !proposal?.author_payout_address) return;
    const prefix = proposal.author_payout_address.split(':')[0];
    const publicKey = wizard.manager.getPubkey(0, 0n);
    if (!publicKey) return;
    try {
      const derived = addressFromPublicKey(publicKey, prefix);
      setWallet(derived);
      rememberFundingWallet(derived.address);
    } catch (err) {
      setError(err.message);
    }
  }, [wizard.manager, wizard.state, proposal]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || t('funding.saveError'));
    } finally {
      setBusy(false);
    }
  };

  const chooseUtxo = async (needed) => {
    const utxos = await pathFundingApi.getUtxos(wallet.address);
    const coin = utxos.find((item) => !item.token && item.satoshis >= needed && item.vout === 0)
      || utxos.find((item) => !item.token && item.satoshis >= needed);
    if (!coin) {
      throw new Error(t('funding.noCoin'));
    }
    return coin;
  };

  if (!proposal) {
    return <Container sx={{ py: 3 }}>{error && <Alert severity="error">{error}</Alert>}</Container>;
  }

  const isAuthor = user?.username === proposal.author;
  const ownPledge = proposal.pledges?.find((pledge) => (
    wallet && pledge.wallet_address === wallet.address && pledge.status === 'confirmed'
  ));

  return (
    <Container sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h4">{proposal.title}</Typography>
        <Typography color="text.secondary">{proposal.pitch}</Typography>
        <Typography>
          {t('funding.progress', {
            raised: proposal.raised_sats,
            goal: proposal.goal_sats,
            status: proposal.status,
          })}
        </Typography>
        <Typography variant="body2">
          {t('funding.by', { author: proposal.author })}
          {' · '}
          <RouterLink to={`/knowledge_path/${proposal.knowledge_path_id}`}>
            {t('funding.pathLink')}
          </RouterLink>
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}
        {wizard.error && <Alert severity="warning">{wizard.error}</Alert>}

        <Paper sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">{t('funding.walletTitle')}</Typography>
            <Typography variant="body2">
              {wallet ? wallet.address : t('funding.walletHelp')}
            </Typography>
            {wizard.state !== 'connected' && (
              <Button variant="outlined" onClick={wizard.connect}>{t('funding.connect')}</Button>
            )}
            {wizard.state === 'connected' && (
              <Button onClick={wizard.disconnect}>{t('funding.disconnect')}</Button>
            )}
          </Stack>
        </Paper>

        {proposal.status === 'draft' && isAuthor && (
          <Button
            variant="contained"
            disabled={busy || !wallet}
            onClick={() => run(async () => {
              const contractInfo = await pathFundingApi.getContract();
              const utxo = await chooseUtxo(3000);
              if (utxo.vout !== 0) {
                throw new Error(t('funding.needGenesisCoin'));
              }
              const opened = await openCampaignTx({
                manager: wizard.manager,
                artifact: contractInfo.artifact,
                proposal,
                utxo,
                userAddress: wallet.address,
                addressIndex: 0,
                prefix: proposal.author_payout_address.split(':')[0],
              });
              await pathFundingApi.openProposal(proposal.id, {
                campaign_txid: opened.txid,
                campaign_vout: 0,
              });
              setNotice(t('funding.opened'));
            })}
          >
            {t('funding.openOnChain')}
          </Button>
        )}

        {proposal.status === 'open' && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              label={t('funding.pledgeAmount')}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <Button
              variant="contained"
              disabled={busy || !wallet}
              onClick={() => run(async () => {
                const [contractInfo, campaign] = await Promise.all([
                  pathFundingApi.getContract(),
                  pathFundingApi.getCampaign(proposal.id),
                ]);
                const pledgeAmount = Number(amount);
                const utxo = await chooseUtxo(pledgeAmount + 3000);
                const signed = await pledgeTx({
                  manager: wizard.manager,
                  artifact: contractInfo.artifact,
                  proposal,
                  campaign,
                  amountSats: pledgeAmount,
                  utxo,
                  userAddress: wallet.address,
                  lockingBytecode: wallet.lockingBytecode,
                  addressIndex: 0,
                  prefix: proposal.author_payout_address.split(':')[0],
                });
                await pathFundingApi.recordPledge(proposal.id, signed);
                setNotice(t('funding.pledged'));
              })}
            >
              {t('funding.pledge')}
            </Button>
          </Stack>
        )}

        {ownPledge && (proposal.status === 'open' || proposal.status === 'expired') && (
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => run(async () => {
              const [contractInfo, spec] = await Promise.all([
                pathFundingApi.getContract(),
                pathFundingApi.refundSpec(proposal.id, ownPledge.id),
              ]);
              await refundTx({
                manager: wizard.manager,
                artifact: contractInfo.artifact,
                proposal,
                spec,
                userAddress: wallet.address,
                addressIndex: 0,
              });
              setNotice(t('funding.refunded'));
            })}
          >
            {t('funding.refund')}
          </Button>
        )}

        {proposal.status === 'funded' && (
          <Button
            variant="contained"
            disabled={busy || !wallet}
            onClick={() => run(async () => {
              const [contractInfo, spec] = await Promise.all([
                pathFundingApi.getContract(),
                pathFundingApi.claimSpec(proposal.id),
              ]);
              const feeUtxo = await chooseUtxo(2000);
              await claimTx({
                manager: wizard.manager,
                artifact: contractInfo.artifact,
                proposal,
                spec,
                feeUtxo,
                userAddress: wallet.address,
                addressIndex: 0,
              });
              setNotice(t('funding.claimed'));
            })}
          >
            {t('funding.claim')}
          </Button>
        )}

        <Paper sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">{t('funding.recordTitle')}</Typography>
            <TextField
              label={t('funding.txid')}
              value={txid}
              onChange={(event) => setTxid(event.target.value)}
            />
            <Button
              variant="outlined"
              disabled={busy || !txid}
              onClick={() => run(async () => {
                await pathFundingApi.recordPledge(proposal.id, txid.trim());
                setTxid('');
                setNotice(t('funding.recorded'));
              })}
            >
              {t('funding.record')}
            </Button>
          </Stack>
        </Paper>

        <Stack spacing={1}>
          {(proposal.pledges || []).map((pledge) => (
            <Typography key={pledge.id} variant="body2">
              {pledge.amount_sats} sats · {pledge.status} · {pledge.wallet_address}
            </Typography>
          ))}
        </Stack>
      </Stack>

      {wizard.uri && wizard.qrUri && (
        <WizardConnectQRDialog
          show={wizard.state === 'connecting'}
          onClose={wizard.disconnect}
          uri={wizard.uri}
          qrUri={wizard.qrUri}
        />
      )}
    </Container>
  );
};

export default FundingDetail;

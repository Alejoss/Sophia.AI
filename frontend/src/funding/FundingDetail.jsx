import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useWizardConnect, WizardConnectQRDialog } from '@wizardconnect/react';
import pathFundingApi from '../api/pathFundingApi';
import knowledgePathsApi from '../api/knowledgePathsApi';
import { getUserFromLocalStorage } from '../context/localStorageUtils';
import {
  claimTx,
  expireTx,
  openCampaignTx,
  pledgeTx,
  findOpenWallet,
  prepareOpenCoinTx,
  refundTx,
  selectOpenCoin,
} from './buildCampaignTx';
import { isValidCashAddr } from './cashaddr';
import { rememberFundingWallet } from './fundingWallet';

function visibleFundingError(err, t) {
  const data = err?.response?.data || {};
  if (data.code === 'not_published') return t('funding.notPublished');
  if (data.code === 'broadcast_rejected') return t('funding.broadcastRejected');
  const message = data.error || err?.message || '';
  if (/mempool or blockchain transaction|no se pudo cargar la transacci/i.test(message)) {
    return t('funding.notPublished');
  }
  return message || t('funding.saveError');
}

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
  const [checkingWallet, setCheckingWallet] = useState(false);
  const [draftStep, setDraftStep] = useState('choose');
  const [receiveAddress, setReceiveAddress] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [pathChoices, setPathChoices] = useState([]);
  const [pathChoice, setPathChoice] = useState('');
  const [balanceCheck, setBalanceCheck] = useState(0);
  const pairedHere = useRef(false);
  const wizard = useWizardConnect({ dappName: 'Academia Blockchain' });
  const wizardRef = useRef(wizard);
  wizardRef.current = wizard;
  const user = getUserFromLocalStorage();
  const walletReady = wizard.state === 'connected' && Boolean(wallet);

  const connectWallet = async () => {
    pairedHere.current = true;
    const current = wizardRef.current;
    if (current.state === 'connecting' || current.state === 'reconnecting' || current.state === 'connected') {
      await current.disconnect();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    wizardRef.current.connect();
  };

  const disconnectWallet = async () => {
    pairedHere.current = false;
    setDraftStep('choose');
    setReceiveAddress('');
    setWallet(null);
    await wizardRef.current.disconnect();
  };

  const reload = () => pathFundingApi.getProposal(proposalId).then(setProposal);

  useEffect(() => {
    reload().catch(() => setError(t('funding.loadError')));
  }, [proposalId, t]);

  useEffect(() => {
    if (!proposal || proposal.knowledge_path_id) return undefined;
    if (!user || user.username !== proposal.author) return undefined;
    if (proposal.status !== 'funded' && proposal.status !== 'claimed') return undefined;
    let active = true;
    knowledgePathsApi.getUserKnowledgePaths(1, 100).then((data) => {
      const rows = data?.results || data;
      if (active) setPathChoices(Array.isArray(rows) ? rows : []);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [proposal, user]);

  useEffect(() => {
    const manager = wizard.manager;
    if (!manager) return undefined;
    const refresh = () => setBalanceCheck((value) => value + 1);
    manager.on('walletready', refresh);
    return () => manager.off('walletready', refresh);
  }, [wizard.manager]);

  useEffect(() => {
    const prefix = proposal?.author_payout_address?.split(':')[0] || proposal?.network_prefix;
    if (!wizard.manager || !prefix || wizard.state !== 'connected') {
      setWallet(null);
      return undefined;
    }
    let active = true;
    setCheckingWallet(true);
    setError('');
    findOpenWallet({
      manager: wizard.manager,
      prefix,
      getUtxos: (address) => pathFundingApi.getUtxos(address),
    }).then((found) => {
      if (!active) return;
      setWallet(found);
      if (found) rememberFundingWallet(found.address);
    }).catch((err) => {
      if (active) setError(err.message || t('funding.loadError'));
    }).finally(() => {
      if (active) setCheckingWallet(false);
    });
    return () => {
      active = false;
    };
  }, [wizard.manager, wizard.state, proposal, balanceCheck, t]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await reload();
    } catch (err) {
      setNotice('');
      setStatusNote('');
      setError(visibleFundingError(err, t));
    } finally {
      setBusy(false);
    }
  };

  const continueToOpen = () => {
    const address = receiveAddress.trim();
    const prefix = proposal.network_prefix;
    if (!isValidCashAddr(address) || !address.toLowerCase().startsWith(`${prefix}:`)) {
      setError(t('funding.payoutNetwork', { prefix }));
      return;
    }
    setError('');
    setDraftStep('confirm');
  };

  const openInvestigation = () => run(async () => {
    const address = receiveAddress.trim();
    const feeAddress = wallet.address;
    const prefix = proposal.network_prefix;
    if (!isValidCashAddr(address) || !address.toLowerCase().startsWith(`${prefix}:`)) {
      throw new Error(t('funding.payoutNetwork', { prefix }));
    }
    const current = proposal.author_payout_address === address
      ? proposal
      : await pathFundingApi.setPayoutAddress(proposal.id, address);
    const contractInfo = await pathFundingApi.getContract();
    const picked = selectOpenCoin(await pathFundingApi.getUtxos(feeAddress));
    if (!picked.utxo) {
      throw new Error(t('funding.noCoin', { sats: picked.minimum, address: feeAddress }));
    }
    let utxo = picked.utxo;
    if (picked.needsPrepare) {
      setStatusNote(t('funding.approveMove'));
      const prepared = await prepareOpenCoinTx({
        manager: wizard.manager,
        utxo,
        userAddress: feeAddress,
        addressIndex: wallet.index,
      });
      setStatusNote(t('funding.publishingMove'));
      await pathFundingApi.broadcast(prepared.rawHex);
      utxo = { txid: prepared.txid, vout: 0, satoshis: prepared.satoshis };
    }
    setStatusNote(t('funding.approveOpen'));
    const opened = await openCampaignTx({
      manager: wizard.manager,
      artifact: contractInfo.artifact,
      proposal: current,
      utxo,
      userAddress: feeAddress,
      addressIndex: wallet.index,
      prefix: address.split(':')[0],
    });
    setStatusNote(t('funding.publishingOpen'));
    await pathFundingApi.openProposal(proposal.id, {
      campaign_txid: opened.txid,
      campaign_vout: 0,
      raw_tx: opened.rawHex,
    });
    setStatusNote('');
    setNotice(t('funding.opened'));
  });

  const chooseUtxo = async (needed) => {
    const utxos = await pathFundingApi.getUtxos(wallet.address);
    const coin = utxos.find((item) => !item.token && item.satoshis >= needed && item.vout === 0)
      || utxos.find((item) => !item.token && item.satoshis >= needed);
    if (!coin) {
      throw new Error(t('funding.noCoin', { sats: needed, address: wallet.address }));
    }
    return coin;
  };

  if (!proposal) {
    return <Container sx={{ py: 3 }}>{error && <Alert severity="error">{error}</Alert>}</Container>;
  }

  const isAuthor = user?.username === proposal.author;
  const deadlinePassed = Number.isFinite(Date.parse(proposal.deadline))
    && Date.parse(proposal.deadline) <= Date.now();
  const pledgesOpen = proposal.status === 'open' && !deadlinePassed;
  const ownPledge = proposal.pledges?.find((pledge) => (
    wallet && pledge.wallet_address === wallet.address && pledge.status === 'confirmed'
  ));
  const draftPhase = wizard.state !== 'connected'
    ? 'connect'
    : !wallet
      ? 'waiting'
      : !wallet.picked?.utxo
        ? 'needCoins'
        : draftStep === 'confirm'
          ? 'confirm'
          : 'choose';

  return (
    <Container sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h4">{proposal.title}</Typography>
          {isAuthor && (
            <Button component={RouterLink} to={`/knowledge_path/funding/${proposal.id}/edit`} variant="outlined">
              {t('funding.edit')}
            </Button>
          )}
        </Stack>
        <Typography color="text.secondary">{proposal.pitch}</Typography>
        <Typography>
          {t('funding.progress', {
            raised: proposal.raised_sats,
            goal: proposal.goal_sats,
            status: t(`funding.statuses.${proposal.status}`, { defaultValue: proposal.status }),
          })}
        </Typography>
        <Typography variant="body2">
          {t('funding.by', { author: proposal.author })}
          {proposal.knowledge_path_id && (
            <>
              {' · '}
              <RouterLink to={`/knowledge_path/${proposal.knowledge_path_id}`}>
                {t('funding.pathLink')}
              </RouterLink>
            </>
          )}
        </Typography>
        {!proposal.knowledge_path_id && isAuthor && (
          <Typography variant="body2" color="text.secondary">
            {t('funding.pathMissing')}
            {' '}
            {proposal.status !== 'funded' && proposal.status !== 'claimed' && t('funding.pathLinkLater')}
          </Typography>
        )}
        {!proposal.knowledge_path_id && isAuthor && (proposal.status === 'funded' || proposal.status === 'claimed') && (
          <Paper sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="h6">{t('funding.linkPathTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('funding.linkPathHelp')}</Typography>
              {pathChoices.length === 0 ? (
                <>
                  <Typography variant="body2">{t('funding.linkPathEmpty')}</Typography>
                  <Button component={RouterLink} to="/knowledge_path/create" variant="contained">
                    {t('funding.linkPathCreate')}
                  </Button>
                </>
              ) : (
                <>
                  <TextField
                    select
                    label={t('funding.pathLink')}
                    value={pathChoice}
                    onChange={(event) => setPathChoice(event.target.value)}
                    fullWidth
                  >
                    {pathChoices.map((path) => (
                      <MenuItem key={path.id} value={String(path.id)}>{path.title}</MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    disabled={!pathChoice || busy}
                    onClick={() => run(async () => {
                      const updated = await pathFundingApi.linkKnowledgePath(proposal.id, Number(pathChoice));
                      setProposal(updated);
                      setNotice(t('funding.pathLinked'));
                    })}
                  >
                    {t('funding.linkPath')}
                  </Button>
                </>
              )}
            </Stack>
          </Paper>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}
        {wizard.error && <Alert severity="warning">{wizard.error}</Alert>}

        {proposal.status === 'draft' && isAuthor && (
          <Paper sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              {draftPhase === 'connect' && (
                <>
                  <Typography variant="h6">{t('funding.draftConnectTitle')}</Typography>
                  <Typography variant="body2" color="text.secondary">{t('funding.draftConnectBody')}</Typography>
                  <Button variant="contained" onClick={connectWallet}>{t('funding.connect')}</Button>
                </>
              )}
              {draftPhase === 'waiting' && (
                <>
                  <Typography variant="h6">{t('funding.draftWaitingTitle')}</Typography>
                  <Typography variant="body2" color="text.secondary">{t('funding.draftWaitingBody')}</Typography>
                  <Button onClick={disconnectWallet}>{t('funding.disconnect')}</Button>
                </>
              )}
              {draftPhase === 'needCoins' && (
                <>
                  <Typography variant="h6">{t('funding.draftNeedTitle')}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('funding.draftNeedBody', { sats: wallet.picked?.minimum || 3001 })}
                  </Typography>
                  {!pairedHere.current && (
                    <Typography variant="body2" color="text.secondary">{t('funding.draftWalletRestored')}</Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">{t('funding.feeWalletLabel')}</Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{wallet.address}</Typography>
                  <Typography variant="caption" color="text.secondary">{t('funding.feeWalletNote')}</Typography>
                  <Button variant="contained" disabled={checkingWallet} onClick={() => setBalanceCheck((value) => value + 1)}>
                    {t('funding.checkCoins')}
                  </Button>
                  <Button onClick={disconnectWallet}>{t('funding.disconnect')}</Button>
                </>
              )}
              {draftPhase === 'choose' && (
                <>
                  <Typography variant="h6">{t('funding.receiveStepTitle')}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('funding.receiveStepBody', { prefix: proposal.network_prefix || 'bitcoincash' })}
                  </Typography>
                  <TextField
                    label={t('funding.receiveTitle')}
                    value={receiveAddress}
                    onChange={(event) => setReceiveAddress(event.target.value)}
                    placeholder={`${proposal.network_prefix || 'bitcoincash'}:`}
                    fullWidth
                  />
                  <Button variant="contained" onClick={continueToOpen}>{t('funding.receiveContinue')}</Button>
                  <Button onClick={disconnectWallet}>{t('funding.disconnect')}</Button>
                </>
              )}
              {draftPhase === 'confirm' && (
                <>
                  <Typography variant="h6">{t('funding.openStepTitle')}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {statusNote || (wallet.picked?.needsPrepare ? t('funding.openStepBodyTwo') : t('funding.openStepBody'))}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{t('funding.receiveTitle')}</Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{receiveAddress.trim()}</Typography>
                  <Typography variant="caption" color="text.secondary">{t('funding.feeWalletLabel')}</Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{wallet.address}</Typography>
                  <Typography variant="caption" color="text.secondary">{t('funding.feeWalletNote')}</Typography>
                  <Button variant="contained" disabled={busy} onClick={openInvestigation}>
                    {t('funding.openOnChain')}
                  </Button>
                  <Button disabled={busy} onClick={() => { setError(''); setDraftStep('choose'); }}>{t('funding.changeReceive')}</Button>
                  <Button disabled={busy} onClick={disconnectWallet}>{t('funding.disconnect')}</Button>
                </>
              )}
            </Stack>
          </Paper>
        )}

        {proposal.status === 'draft' && !isAuthor && (
          <Typography color="text.secondary">{t('funding.draftClosed')}</Typography>
        )}

        {proposal.status !== 'draft' && (
          <Paper sx={{ p: 2 }}>
            <Stack spacing={1.5} alignItems="flex-start">
              <Typography variant="h6">{t('funding.walletTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {walletReady ? wallet.address : t('funding.walletHelp')}
              </Typography>
              {walletReady && (
                <Typography variant="caption" color="text.secondary">{t('funding.pledgeWalletNote')}</Typography>
              )}
              {wizard.state !== 'connected' && (
                <Button variant="contained" onClick={connectWallet}>{t('funding.connect')}</Button>
              )}
              {wizard.state === 'connected' && (
                <Button onClick={wizard.disconnect}>{t('funding.disconnect')}</Button>
              )}
            </Stack>
          </Paper>
        )}

        {pledgesOpen && (
          <Stack spacing={1.5} alignItems="flex-start">
            <Typography variant="body2" color="text.secondary">{t('funding.pledgeHow')}</Typography>
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
                  addressIndex: wallet.index,
                  prefix: proposal.network_prefix || 'bitcoincash',
                });
                await pathFundingApi.recordPledge(proposal.id, signed.txid, signed.rawHex);
                setNotice(t('funding.pledged'));
              })}
            >
              {t('funding.pledge')}
            </Button>
            </Stack>
          </Stack>
        )}

        {proposal.status === 'open' && deadlinePassed && proposal.raised_sats < proposal.goal_sats && (
          <Paper sx={{ p: 2 }}>
            <Stack spacing={1.5} alignItems="flex-start">
              <Typography variant="h6">{t('funding.expireTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('funding.expireHelp')}</Typography>
              <Button
                variant="contained"
                disabled={busy || !wallet}
                onClick={() => run(async () => {
                  const [contractInfo, campaign] = await Promise.all([
                    pathFundingApi.getContract(),
                    pathFundingApi.getCampaign(proposal.id),
                  ]);
                  const feeUtxo = await chooseUtxo(2000);
                  const signed = await expireTx({
                    manager: wizard.manager,
                    artifact: contractInfo.artifact,
                    proposal,
                    campaign,
                    feeUtxo,
                    userAddress: wallet.address,
                    addressIndex: wallet.index,
                  });
                  const updated = await pathFundingApi.recordPledge(proposal.id, signed.txid, signed.rawHex);
                  setProposal(updated);
                  setNotice(t('funding.expired'));
                })}
              >
                {t('funding.expire')}
              </Button>
            </Stack>
          </Paper>
        )}

        {ownPledge && (proposal.status === 'expired' || pledgesOpen) && (
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => run(async () => {
              const [contractInfo, spec] = await Promise.all([
                pathFundingApi.getContract(),
                pathFundingApi.refundSpec(proposal.id, ownPledge.id),
              ]);
              const signed = await refundTx({
                manager: wizard.manager,
                artifact: contractInfo.artifact,
                proposal,
                spec,
                userAddress: wallet.address,
                addressIndex: wallet.index,
              });
              const updated = await pathFundingApi.recordPledge(proposal.id, signed.txid, signed.rawHex);
              setProposal(updated);
              setNotice(t('funding.refunded'));
            })}
          >
            {t('funding.refund')}
          </Button>
        )}

        {proposal.status === 'funded' && isAuthor && (
          <Button
            variant="contained"
            disabled={busy || !wallet}
            onClick={() => run(async () => {
              const [contractInfo, spec] = await Promise.all([
                pathFundingApi.getContract(),
                pathFundingApi.claimSpec(proposal.id),
              ]);
              const feeUtxo = await chooseUtxo(2000);
              const signed = await claimTx({
                manager: wizard.manager,
                artifact: contractInfo.artifact,
                proposal,
                spec,
                feeUtxo,
                userAddress: wallet.address,
                addressIndex: wallet.index,
              });
              const updated = await pathFundingApi.recordPledge(proposal.id, signed.txid, signed.rawHex);
              setProposal(updated);
              setNotice(t('funding.claimed'));
            })}
          >
            {t('funding.claim')}
          </Button>
        )}

        {pledgesOpen && (
        <Paper sx={{ p: 2 }}>
          <Stack spacing={1.5} alignItems="flex-start">
            <Typography variant="h6">{t('funding.recordTitle')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('funding.recordHelp')}</Typography>
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
        )}

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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import certificatesApi from '../api/certificatesApi';

const ADDRESS_EXPLORER = 'https://sepolia.etherscan.io/address/';
const TX_EXPLORER = 'https://sepolia.etherscan.io/tx/';

const formatError = (err, fallback) => {
  const data = err?.response?.data;
  const msg = data?.error || data?.detail || err?.message;
  if (typeof msg === 'string') return msg;
  return fallback;
};

const shortAddress = (value) => {
  if (!value || value.length < 12) return value || '';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
};

const ContractCard = ({ title, hint, contract }) => {
  const { t } = useTranslation('certificates');
  return (
  <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: '100%' }}>
    <Typography variant="overline" color="text.secondary">
      {title}
    </Typography>
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
      {contract?.name || t('contract.disconnected')}
      {contract?.symbol ? ` · ${contract.symbol}` : ''}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
      {hint}
    </Typography>
    {contract?.address ? (
      <Link href={`${ADDRESS_EXPLORER}${contract.address}`} target="_blank" rel="noopener noreferrer" variant="caption">
        {shortAddress(contract.address)}
      </Link>
    ) : (
      <Typography variant="caption" color="text.secondary">
        {contract?.error || t('contract.notDeployed')}
      </Typography>
    )}
  </Paper>
  );
};

const TokenPanel = ({
  kicker,
  title,
  body,
  done,
  doneLabel,
  owner,
  txHash,
  error,
  action,
}) => {
  const { t } = useTranslation('certificates');
  return (
  <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2, height: '100%' }}>
    <Typography variant="overline" color="text.secondary">
      {kicker}
    </Typography>
    {title ? (
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
    ) : null}
    {body ? (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {body}
      </Typography>
    ) : null}
    <Stack spacing={1} alignItems="flex-start">
      {done ? (
        <Chip size="small" color="success" label={doneLabel} />
      ) : null}
      {owner && (
        <Typography variant="caption" color="text.secondary">
          {t('token.owner', { address: shortAddress(owner) })}
        </Typography>
      )}
      {txHash && (
        <Link href={`${TX_EXPLORER}${txHash}`} target="_blank" rel="noopener noreferrer" variant="caption">
          {t('token.viewTx')}
        </Link>
      )}
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
      {action}
    </Stack>
  </Box>
  );
};

const groupCertificates = (rows, language, untitled) => {
  const byPath = new Map();
  for (const row of rows) {
    const id = row.knowledgePathDbId;
    if (!byPath.has(id)) {
      byPath.set(id, {
        id,
        title: row.knowledgePathTitle || untitled,
        snapshotVersion: row.snapshotVersion || null,
        rows: [],
      });
    }
    const group = byPath.get(id);
    group.rows.push(row);
    if (row.snapshotVersion) group.snapshotVersion = row.snapshotVersion;
  }
  const groups = [...byPath.values()].sort((left, right) => left.title.localeCompare(right.title, language));
  for (const group of groups) {
    group.rows.sort((left, right) => (left.learner || '').localeCompare(right.learner || '', language));
  }
  return {
    ready: groups.filter((group) => group.snapshotVersion),
    waiting: groups.filter((group) => !group.snapshotVersion),
  };
};

const pathSummary = (group, t) => {
  const pending = group.rows.some((row) => !row.chain?.tokenId || !row.reward?.tokenId);
  const base = t('dashboard.pathSummary', {
    count: group.rows.length,
    version: group.snapshotVersion,
  });
  return pending ? base : `${base}${t('dashboard.readySuffix')}`;
};

const StudentCard = ({
  row,
  contract,
  rewardContract,
  recipient,
  onRecipient,
  working,
  busy,
  onRegister,
  onMint,
  onImage,
  onReward,
}) => {
  const { t } = useTranslation('certificates');
  const chain = row.chain;
  const reward = row.reward;
  const certificateMinted = Boolean(chain?.tokenId);
  const rewardMinted = Boolean(reward?.tokenId);
  const registered = Boolean(chain?.achievementRegistered);
  const hasSnapshot = Boolean(row.snapshotVersion);
  const bothDone = certificateMinted && rewardMinted;
  const confirmingReward = row.rewardStatus === 'minting';

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        {row.learner}
      </Typography>
      <TextField
        fullWidth
        size="small"
        label={t('student.walletLabel')}
        placeholder="0x…"
        value={recipient}
        disabled={bothDone || working}
        onChange={(event) => onRecipient(event.target.value)}
        sx={{ mb: 2 }}
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <TokenPanel
          kicker={t('student.certificateKicker')}
          body={
            certificateMinted
              ? ''
              : t('student.certificateBody')
          }
          done={certificateMinted}
          doneLabel={t('student.certificateDone', { tokenId: chain?.tokenId })}
          owner={chain?.owner}
          txHash={row.transactionHash}
          error={chain?.error || row.ethereumError}
          action={!certificateMinted && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {hasSnapshot && !registered && (
                <Button
                  size="small"
                  variant="outlined"
                  disabled={working || !contract?.reachable || row.ethereumStatus === 'registering'}
                  onClick={() => onRegister(row)}
                >
                  {row.ethereumStatus === 'registering' ? t('student.confirming') : t('student.registerVersion')}
                </Button>
              )}
              <Button
                size="small"
                variant="contained"
                disabled={working || !registered || !contract?.reachable || row.ethereumStatus === 'minting'}
                onClick={() => onMint(row)}
              >
                {row.ethereumStatus === 'minting' ? t('student.confirming') : t('student.mintCertificate')}
              </Button>
            </Stack>
          )}
        />
        <TokenPanel
          kicker={t('student.rewardKicker')}
          body={rewardMinted ? '' : t('student.rewardBody')}
          done={rewardMinted}
          doneLabel={t('student.rewardDone', { tokenId: reward?.tokenId })}
          owner={reward?.owner}
          txHash={row.rewardTransactionHash}
          error={rewardContract?.reachable ? (reward?.error || row.rewardError) : row.rewardError}
          action={(
            <Stack spacing={1.25} alignItems="flex-start">
              {(row.rewardImageFile || (row.rewardImage && row.rewardImage.startsWith('http'))) && (
                <Box
                  component="img"
                  src={row.rewardImageFile || row.rewardImage}
                  alt=""
                  sx={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 2, border: 1, borderColor: 'divider' }}
                />
              )}
              <Button size="small" variant="outlined" component="label" disabled={working}>
                {busy === `${row.id}:image` ? t('student.savingImage') : (row.rewardImage ? t('student.changeImage') : t('student.uploadImage'))}
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    onImage(row, file);
                  }}
                />
              </Button>
              {!rewardMinted && (
                <Button
                  size="small"
                  variant="contained"
                  disabled={working || !hasSnapshot || !rewardContract?.reachable || confirmingReward}
                  onClick={() => onReward(row)}
                >
                  {confirmingReward ? t('student.confirming') : t('student.mintNft')}
                </Button>
              )}
            </Stack>
          )}
        />
      </Box>
    </Paper>
  );
};

const EthereumCredentialsDashboard = () => {
  const { t, i18n } = useTranslation('certificates');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(null);
  const [recipients, setRecipients] = useState({});
  const [selectedPathId, setSelectedPathId] = useState(null);

  const load = useCallback(async (options = {}) => {
    const quiet = options.quiet === true;
    try {
      if (!quiet) {
        setLoading(true);
        setError(null);
      }
      const data = await certificatesApi.getEthereumCredentialDashboard();
      setPayload(data);
      setRecipients((current) => {
        const next = { ...current };
        for (const row of data.certificates || []) {
          if (next[row.id] === undefined) {
            next[row.id] = row.rewardRecipient || row.recipient || '';
          }
        }
        return next;
      });
    } catch (err) {
      setError(formatError(err, t('dashboard.loadFailed')));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const hasPending = (payload?.certificates || []).some((row) => (
    row.ethereumStatus === 'minting'
    || row.ethereumStatus === 'registering'
    || row.rewardStatus === 'minting'
  ));
  const wasPending = useRef(false);

  useEffect(() => {
    if (!hasPending) return undefined;
    const timer = setInterval(() => {
      load({ quiet: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [hasPending, load]);

  useEffect(() => {
    if (hasPending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    const failed = (payload?.certificates || []).some((row) => (
      row.ethereumStatus === 'failed' || row.rewardStatus === 'failed'
    ));
    setSuccess(failed ? null : t('dashboard.confirmed'));
  }, [hasPending, payload, t]);

  const requireRecipient = (row) => {
    const recipient = (recipients[row.id] || '').trim();
    if (!recipient) {
      setError(t('dashboard.recipientRequired'));
      return '';
    }
    return recipient;
  };

  const handleRegister = async (row) => {
    try {
      setBusy(`${row.id}:register`);
      setError(null);
      setSuccess(null);
      const result = await certificatesApi.registerEthereumCredentialVersion(row.id);
      if (result.pending) {
        setSuccess(t('dashboard.registerPending'));
      } else {
        setSuccess(
          result.alreadyRegistered
            ? t('dashboard.registerAlready', { version: result.version, title: row.knowledgePathTitle })
            : t('dashboard.registerDone', { version: result.version }),
        );
      }
      await load({ quiet: true });
    } catch (err) {
      setError(formatError(err, t('dashboard.registerFailed')));
    } finally {
      setBusy(null);
    }
  };

  const handleMint = async (row) => {
    const recipient = requireRecipient(row);
    if (!recipient) return;
    try {
      setBusy(`${row.id}:mint`);
      setError(null);
      setSuccess(null);
      const result = await certificatesApi.mintEthereumCredential(row.id, recipient);
      if (result.pending) {
        setSuccess(t('dashboard.mintPending'));
      } else {
        setSuccess(
          result.alreadyMinted
            ? t('dashboard.mintAlready', { learner: row.learner, tokenId: result.tokenId })
            : t('dashboard.mintDone', { tokenId: result.tokenId, recipient: shortAddress(recipient) }),
        );
      }
      await load({ quiet: true });
    } catch (err) {
      setError(formatError(err, t('dashboard.mintFailed')));
    } finally {
      setBusy(null);
    }
  };

  const handleImage = async (row, file) => {
    if (!file) return;
    try {
      setBusy(`${row.id}:image`);
      setError(null);
      setSuccess(null);
      await certificatesApi.uploadEthereumRewardImage(row.id, file);
      setSuccess(t('dashboard.imageSaved', { learner: row.learner }));
      await load();
    } catch (err) {
      setError(formatError(err, t('dashboard.imageFailed')));
    } finally {
      setBusy(null);
    }
  };

  const handleReward = async (row) => {
    const recipient = requireRecipient(row);
    if (!recipient) return;
    try {
      setBusy(`${row.id}:reward`);
      setError(null);
      setSuccess(null);
      const result = await certificatesApi.mintEthereumReward(row.id, recipient);
      if (result.pending) {
        setSuccess(t('dashboard.rewardPending'));
      } else {
        setSuccess(
          result.alreadyMinted
            ? t('dashboard.rewardAlready', { learner: row.learner, tokenId: result.tokenId })
            : t('dashboard.rewardDone', { tokenId: result.tokenId, recipient: shortAddress(recipient) }),
        );
      }
      await load({ quiet: true });
    } catch (err) {
      setError(formatError(err, t('dashboard.rewardFailed')));
    } finally {
      setBusy(null);
    }
  };

  const contract = payload?.contract;
  const rewardContract = payload?.reward;
  const rows = payload?.certificates || [];
  const working = busy !== null;
  const { ready, waiting } = groupCertificates(rows, i18n.language, t('dashboard.untitled'));
  const selected = ready.find((group) => group.id === selectedPathId) || ready[0] || null;
  const waitingTitles = waiting.map((group) => group.title).join(', ');

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {t('dashboard.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        {t('dashboard.intro')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        <ContractCard
          title={t('contract.certificateTitle')}
          hint={t('contract.certificateHint')}
          contract={contract}
        />
        <ContractCard
          title={t('contract.rewardTitle')}
          hint={t('contract.rewardHint')}
          contract={rewardContract}
        />
      </Box>

      {loading && !payload ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={32} />
        </Stack>
      ) : ready.length === 0 ? (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 4 }}>
          <Typography variant="body2" color="text.secondary">
            {waiting.length === 0
              ? t('dashboard.empty')
              : t('dashboard.waiting', { titles: waitingTitles })}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px 1fr' }, gap: 2, alignItems: 'start' }}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              {t('dashboard.pathsHeading')}
            </Typography>
            <List disablePadding>
              {ready.map((group) => (
                <ListItemButton
                  key={group.id}
                  selected={selected?.id === group.id}
                  onClick={() => setSelectedPathId(group.id)}
                  sx={{ borderRadius: 2, mb: 0.5, border: 1, borderColor: 'divider', alignItems: 'flex-start' }}
                >
                  <ListItemText
                    primary={group.title}
                    secondary={pathSummary(group, t)}
                    slotProps={{
                      primary: { variant: 'subtitle2', sx: { fontWeight: 700 } },
                      secondary: { variant: 'caption' },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
            {waiting.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                {t('dashboard.waiting', { titles: waitingTitles })}
              </Typography>
            )}
          </Box>
          {selected && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {selected.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {pathSummary(selected, t)}
                </Typography>
              </Box>
              {selected.rows.map((row) => (
                <StudentCard
                  key={row.id}
                  row={row}
                  contract={contract}
                  rewardContract={rewardContract}
                  recipient={recipients[row.id] ?? ''}
                  onRecipient={(value) => {
                    setRecipients((current) => ({ ...current, [row.id]: value }));
                  }}
                  working={working}
                  busy={busy}
                  onRegister={handleRegister}
                  onMint={handleMint}
                  onImage={handleImage}
                  onReward={handleReward}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
};

export default EthereumCredentialsDashboard;

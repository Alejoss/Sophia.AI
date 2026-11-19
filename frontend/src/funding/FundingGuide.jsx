import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import '../styles/funding-guide.css';

const SECTIONS = ['what', 'path', 'pledge', 'open', 'fixed', 'reached', 'missed', 'reclaim'];

function paragraphsFor(t, id) {
  const paragraphs = t(`funding.guide.${id}Body`, { returnObjects: true });
  return Array.isArray(paragraphs) ? paragraphs : [paragraphs];
}

const FundingGuide = () => {
  const { t } = useTranslation('paths');
  const label = (key) => t(`funding.guide.diagram.${key}`);

  return (
    <Box component="main" className="funding-guide">
      <header className="funding-guide-top">
        <div>
          <Typography component="p" className="funding-guide-kicker">{t('funding.guide.kicker')}</Typography>
          <Typography component="h1">{t('funding.guide.title')}</Typography>
        </div>
      </header>

      <section className="funding-guide-hero">
        <div className="funding-guide-hero-grid">
          <div>
            <Typography component="h2">{t('funding.guide.thesis')}</Typography>
            <Typography component="p" className="funding-guide-intro">{t('funding.guide.intro')}</Typography>
          </div>
          <figure className="crowd-graph" aria-label={label('crowdCaption')}>
            <div className="crowd-head">
              <span>{label('raised')}</span>
              <span>{label('goalLabel')}</span>
            </div>
            <div className="crowd-track" aria-hidden="true">
              <span className="crowd-part crowd-part-a" />
              <span className="crowd-part crowd-part-b" />
              <span className="crowd-part crowd-part-c" />
            </div>
            <ul className="crowd-people">
              <li><i className="crowd-swatch crowd-swatch-a" />{label('onePerson')}</li>
              <li><i className="crowd-swatch crowd-swatch-b" />{label('secondPerson')}</li>
              <li><i className="crowd-swatch crowd-swatch-c" />{label('thirdPerson')}</li>
              <li><i className="crowd-swatch crowd-swatch-open" />{label('stillOpen')}</li>
            </ul>
            <Typography component="figcaption" className="pledge-caption">{label('crowdCaption')}</Typography>
          </figure>
        </div>
      </section>

      <section className="funding-guide-flow" aria-labelledby="funding-guide-flow-title">
        <Typography id="funding-guide-flow-title" component="h2">{label('flowTitle')}</Typography>
        <div className="outcome-graph">
          <div className="flow-node"><span>01</span><strong>{label('open')}</strong></div>
          <div className="flow-arrow" aria-hidden="true">→</div>
          <div className="flow-node"><span>02</span><strong>{label('pledges')}</strong></div>
          <div className="flow-arrow" aria-hidden="true">→</div>
          <div className="outcome-branches">
            <div className="outcome-branch outcome-branch-goal">
              <div className="flow-node"><strong>{label('goal')}</strong></div>
              <div className="flow-arrow" aria-hidden="true">→</div>
              <div className="flow-node"><strong>{label('claim')}</strong></div>
              <div className="flow-arrow" aria-hidden="true">→</div>
              <div className="flow-node"><strong>{label('cashout')}</strong></div>
            </div>
            <div className="outcome-branch outcome-branch-miss">
              <div className="flow-node"><strong>{label('missed')}</strong></div>
              <div className="flow-arrow" aria-hidden="true">→</div>
              <div className="flow-node"><strong>{label('close')}</strong></div>
              <div className="flow-arrow" aria-hidden="true">→</div>
              <div className="flow-node"><strong>{label('reclaim')}</strong></div>
            </div>
          </div>
        </div>
        <Typography component="p" className="pledge-caption" sx={{ mt: 2 }}>{label('sameWallet')}</Typography>
      </section>

      <section className="funding-guide-body">
        {SECTIONS.map((id, index) => (
          <div className="funding-guide-section" key={id}>
            <Typography component="p" className="funding-guide-number">
              {String(index + 1).padStart(2, '0')}
            </Typography>
            <div>
              <Typography component="h3">{t(`funding.guide.${id}Title`)}</Typography>
              {paragraphsFor(t, id).map((paragraph) => (
                <Typography component="p" key={paragraph}>{paragraph}</Typography>
              ))}
            </div>
          </div>
        ))}
      </section>

      <blockquote className="funding-guide-takeaway">
        <Typography component="p">{t('funding.guide.takeaway')}</Typography>
      </blockquote>

      <footer className="funding-guide-footer">
        <RouterLink to="/knowledge_path/funding">{t('funding.guide.back')}</RouterLink>
      </footer>
    </Box>
  );
};

export default FundingGuide;

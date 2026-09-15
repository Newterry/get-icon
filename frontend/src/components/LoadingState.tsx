import { Check, LoaderCircle } from 'lucide-react';
import { useI18n } from '../i18n';

export function LoadingState({ activeStep }: { activeStep: number }) {
  const { t } = useI18n();
  const steps = [t('stepConnect'), t('stepHtml'), t('stepManifest'), t('stepQuality')];
  return (
    <section className="loading-state" aria-live="polite">
      <span className="loading-orbit"><LoaderCircle size={29} /></span>
      <h2>{t('loadingTitle')}</h2>
      <p>{t('loadingDescription')}</p>
      <ol className="loading-steps">
        {steps.map((step, index) => (
          <li key={step} className={index === activeStep ? 'active' : index < activeStep ? 'done' : ''}>
            <span>{index < activeStep ? <Check size={13} /> : index + 1}</span>{step}
          </li>
        ))}
      </ol>
    </section>
  );
}

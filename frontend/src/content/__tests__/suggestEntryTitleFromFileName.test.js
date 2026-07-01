import { describe, expect, it } from 'vitest';
import { suggestEntryTitleFromFileName } from '../inferTitleAuthorFromFileName';

describe('suggestEntryTitleFromFileName', () => {
  it('strips extension and trailing numeric suffix', () => {
    expect(suggestEntryTitleFromFileName('filename_84.pdf')).toBe('Filename');
  });

  it('converts underscores to words', () => {
    expect(suggestEntryTitleFromFileName('chancelor_banks_times.jpg')).toBe('Chancelor Banks Times');
    expect(suggestEntryTitleFromFileName('Analisis_de_las_Cartas_de_Lisboa_y_Barce.pdf')).toBe(
      'Analisis De Las Cartas De Lisboa Y Barce',
    );
  });

  it('uses title part after author separator', () => {
    expect(suggestEntryTitleFromFileName('Author - My Entry_12.mp4')).toBe('My Entry');
  });
});

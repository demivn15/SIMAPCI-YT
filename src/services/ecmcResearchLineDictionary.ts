import { OFFICIAL_RESEARCH_LINES } from '../constants/researchLines';
import type { OfficialResearchLine } from '../types';

export const ECMC_RESEARCH_DICTIONARY_VERSION = 'ecmc-lines-v2';

export interface ResearchLineSuggestion {
  line: OfficialResearchLine;
  strength: 'media' | 'alta';
  matchedKeywords: string[];
}

interface KeywordRule {
  phrase: string;
  weight: number;
}

interface LineRule {
  line: OfficialResearchLine;
  keywords: KeywordRule[];
}

const [mathematics, dataScience, scientificComputing, artificialIntelligence, informationTechnology, scienceTechnologySociety] = OFFICIAL_RESEARCH_LINES;

// Temporary, explicit keyword dictionary for the six ECMC research lines.
// It deliberately uses only publication titles present in the provisional import.
const DICTIONARY: LineRule[] = [
  {
    line: mathematics,
    keywords: [
      { phrase: 'differential equation', weight: 6 }, { phrase: 'differential equations', weight: 6 },
      { phrase: 'partial differential', weight: 6 }, { phrase: 'ecuacion diferencial', weight: 6 },
      { phrase: 'ecuaciones diferenciales', weight: 6 }, { phrase: 'analisis matematico', weight: 6 },
      { phrase: 'mathematical analysis', weight: 6 }, { phrase: 'mathematical modeling', weight: 5 },
      { phrase: 'mathematical modelling', weight: 5 }, { phrase: 'mathematical model', weight: 4 },
      { phrase: 'utility functions', weight: 5 }, { phrase: 'fair allocations', weight: 5 },
      { phrase: 'ecuaciones diferenciales parciales', weight: 7 },
      { phrase: 'ecuacion diferencial parcial', weight: 7 },
      { phrase: 'modelamiento matematico', weight: 5 }, { phrase: 'modelacion matematica', weight: 5 },
      { phrase: 'optimization', weight: 3 }, { phrase: 'optimisation', weight: 3 },
      { phrase: 'utility function', weight: 5 }, { phrase: 'fair allocation', weight: 5 },
      { phrase: 'resource allocation', weight: 4 }, { phrase: 'allocation of resources', weight: 5 },
      { phrase: 'game theory', weight: 4 },
      { phrase: 'chaotic time series', weight: 3 }, { phrase: 'sine function', weight: 4 },
    ],
  },
  {
    line: dataScience,
    keywords: [
      { phrase: 'data science', weight: 7 }, { phrase: 'data mining', weight: 6 },
      { phrase: 'data analysis', weight: 5 }, { phrase: 'data analytics', weight: 6 },
      { phrase: 'ciencia de datos', weight: 7 }, { phrase: 'mineria de datos', weight: 6 },
      { phrase: 'analisis de datos', weight: 5 }, { phrase: 'aprendizaje estadistico', weight: 5 },
      { phrase: 'data acquisition', weight: 4 }, { phrase: 'data set', weight: 4 },
      { phrase: 'dataset', weight: 4 }, { phrase: 'feature extraction', weight: 5 },
      { phrase: 'statistical learning', weight: 5 }, { phrase: 'time series', weight: 4 },
      { phrase: 'forecasting', weight: 4 }, { phrase: 'regression', weight: 3 },
      { phrase: 'correlation', weight: 3 }, { phrase: 'prediction', weight: 2.5 },
      { phrase: 'predicting', weight: 2.5 }, { phrase: 'predictive', weight: 2 },
      { phrase: 'prediccion', weight: 2.5 }, { phrase: 'prediciendo', weight: 2.5 },
      { phrase: 'series temporales', weight: 4 }, { phrase: 'pronostico', weight: 4 },
      { phrase: 'regresion', weight: 3 },
      { phrase: 'predictive modeling', weight: 4 }, { phrase: 'predictive modelling', weight: 4 },
      { phrase: 'dimensionality reduction', weight: 4 }, { phrase: 'feature based', weight: 3 },
      { phrase: 'text features', weight: 3 }, { phrase: 'factores de riesgo', weight: 3 },
      { phrase: 'analysis of factors', weight: 4 },
      { phrase: 'pattern recognition', weight: 3 }, { phrase: 'survey', weight: 2 },
    ],
  },
  {
    line: scientificComputing,
    keywords: [
      { phrase: 'scientific computing', weight: 7 }, { phrase: 'high performance computing', weight: 6 },
      { phrase: 'parallel computing', weight: 6 }, { phrase: 'numerical method', weight: 6 },
      { phrase: 'numerical simulation', weight: 5 }, { phrase: 'computer simulation', weight: 5 },
      { phrase: 'simulation approach', weight: 4 }, { phrase: 'simulations', weight: 3 },
      { phrase: 'simulation', weight: 3 }, { phrase: 'ns 3', weight: 5 },
      { phrase: 'computacion cientifica', weight: 7 }, { phrase: 'computacion de alto rendimiento', weight: 6 },
      { phrase: 'metodos numericos', weight: 6 }, { phrase: 'simulacion', weight: 3 },
      { phrase: 'approximation', weight: 3 }, { phrase: 'computational model', weight: 3 },
      { phrase: 'computational method', weight: 4 }, { phrase: 'algorithm', weight: 2 },
    ],
  },
  {
    line: artificialIntelligence,
    keywords: [
      { phrase: 'artificial intelligence', weight: 5 }, { phrase: 'machine learning', weight: 3 },
      { phrase: 'artificial intelligence in 5g', weight: 7 },
      { phrase: 'artificial intelligence 5g technology', weight: 7 },
      { phrase: 'inteligencia artificial', weight: 5 }, { phrase: 'aprendizaje automatico', weight: 3 },
      { phrase: 'aprendizaje profundo', weight: 5 }, { phrase: 'vision por computador', weight: 5 },
      { phrase: 'vision computacional', weight: 5 }, { phrase: 'red neuronal', weight: 4 },
      { phrase: 'redes neuronales', weight: 4 }, { phrase: 'aprendizaje por refuerzo', weight: 5 },
      { phrase: 'deep learning', weight: 5 }, { phrase: 'reinforcement learning', weight: 5 },
      { phrase: 'neural network', weight: 4 }, { phrase: 'neural networks', weight: 4 },
      { phrase: 'convolutional neural', weight: 5 }, { phrase: 'transformer', weight: 3 },
      { phrase: 'transformers', weight: 3 }, { phrase: 'large language model', weight: 6 },
      { phrase: 'large language models', weight: 6 },
      { phrase: 'language model', weight: 4 }, { phrase: 'llm', weight: 4 },
      { phrase: 'computer vision', weight: 5 }, { phrase: 'image captioning', weight: 5 },
      { phrase: 'image classification', weight: 5 }, { phrase: 'image segmentation', weight: 5 },
      { phrase: 'image recognition', weight: 5 }, { phrase: 'object detection', weight: 5 },
      { phrase: 'automated diagnosis', weight: 5 }, { phrase: 'medical image', weight: 5 },
      { phrase: 'fundus image', weight: 5 }, { phrase: 'image restoration', weight: 4 },
      { phrase: 'image degradation', weight: 4 }, { phrase: 'fake news detection', weight: 5 },
      { phrase: 'doc2vec', weight: 4 }, { phrase: 'som network', weight: 4 },
      { phrase: 'self organizing map', weight: 4 }, { phrase: 'segmentation accuracy', weight: 5 },
      { phrase: 'neural network architecture', weight: 5 }, { phrase: 'dilated convolutions', weight: 4 },
      { phrase: 'lstm', weight: 4 },
      { phrase: 'generative', weight: 3 }, { phrase: 'diffusion model', weight: 4 },
      { phrase: 'diffusion models', weight: 4 },
      { phrase: 'autoencoder', weight: 4 }, { phrase: 'transfer learning', weight: 4 },
      { phrase: 'cnn', weight: 3 }, { phrase: 'yolov8', weight: 4 }, { phrase: 'yolov5', weight: 4 },
      { phrase: 'ai', weight: 3 },
    ],
  },
  {
    line: informationTechnology,
    keywords: [
      { phrase: 'wireless network', weight: 6 }, { phrase: 'wireless networks', weight: 6 },
      { phrase: 'red inalambrica', weight: 6 }, { phrase: 'redes inalambricas', weight: 6 },
      { phrase: 'redes vehiculares', weight: 5 }, { phrase: 'control de congestion', weight: 5 },
      { phrase: 'protocolo de enrutamiento', weight: 5 }, { phrase: 'telecomunicaciones', weight: 5 },
      { phrase: 'internet de las cosas', weight: 5 }, { phrase: 'ciberseguridad', weight: 5 },
      { phrase: 'aplicacion web', weight: 4 }, { phrase: 'red inteligente', weight: 4 },
      { phrase: 'salto multiple', weight: 4 },
      { phrase: 'trafico vehicular', weight: 4 }, { phrase: 'wireless technology', weight: 5 },
      { phrase: 'rsu', weight: 4 }, { phrase: 'ieee 802 11p', weight: 4 }, { phrase: 'physical layer', weight: 3.5 },
      { phrase: 'vehicular ad hoc', weight: 6 }, { phrase: 'congestion control', weight: 5 },
      { phrase: 'routing protocol', weight: 5 }, { phrase: 'routing', weight: 3 },
      { phrase: 'multi hop', weight: 4 }, { phrase: 'smart grid', weight: 4 },
      { phrase: 'wireless', weight: 3 }, { phrase: 'network', weight: 2.5 },
      { phrase: 'communication', weight: 2.5 }, { phrase: 'communications', weight: 2.5 },
      { phrase: 'telecommunication', weight: 5 }, { phrase: 'telecommunications', weight: 5 },
      { phrase: 'communication networks', weight: 5 }, { phrase: 'communication network', weight: 5 },
      { phrase: '5g', weight: 4 }, { phrase: 'internet of things', weight: 5 },
      { phrase: 'cybersecurity', weight: 5 }, { phrase: 'software engineering', weight: 5 },
      { phrase: 'web application', weight: 4 }, { phrase: 'network simulator', weight: 4 },
      { phrase: 'network simulators', weight: 4 }, { phrase: 'python framework', weight: 4 },
      { phrase: 'network infrastructure', weight: 4 }, { phrase: 'protocol', weight: 2 },
      { phrase: 'gpon', weight: 5 }, { phrase: 'massive mimo', weight: 4 },
      { phrase: 'spectrum allocation', weight: 4 }, { phrase: 'distributed systems', weight: 4 },
    ],
  },
  {
    line: scienceTechnologySociety,
    keywords: [
      { phrase: 'science technology and society', weight: 7 }, { phrase: 'science policy', weight: 5 },
      { phrase: 'ciencia tecnologia y sociedad', weight: 7 }, { phrase: 'ciencia tecnologia sociedad', weight: 7 },
      { phrase: 'justicia social', weight: 5 }, { phrase: 'ciencias sociales', weight: 5 },
      { phrase: 'filosofia', weight: 4 }, { phrase: 'pedagogia', weight: 5 },
      { phrase: 'filosofico', weight: 4 }, { phrase: 'antropologica', weight: 4 },
      { phrase: 'educacion', weight: 3 }, { phrase: 'educativo', weight: 3 },
      { phrase: 'etica', weight: 4 }, { phrase: 'didactica', weight: 4 }, { phrase: 'didacticas', weight: 4 },
      { phrase: 'formacion docente', weight: 4 }, { phrase: 'pensamiento pedagogico', weight: 4 },
      { phrase: 'migracion', weight: 3 }, { phrase: 'cultura', weight: 2 },
      { phrase: 'humanidades', weight: 4 }, { phrase: 'comunidad', weight: 2 },
      { phrase: 'social science', weight: 5 }, { phrase: 'social justice', weight: 5 },
      { phrase: 'philosophy', weight: 4 },
      { phrase: 'pedagogy', weight: 5 }, { phrase: 'pedagogical', weight: 4 },
      { phrase: 'education', weight: 3 }, { phrase: 'educational', weight: 3 },
      { phrase: 'ethics', weight: 4 }, { phrase: 'ethical', weight: 4 },
      { phrase: 'migration', weight: 3 }, { phrase: 'sociolinguistic', weight: 5 },
      { phrase: 'language and culture', weight: 5 }, { phrase: 'humanities', weight: 4 },
      { phrase: 'ciencias humanas', weight: 4 }, { phrase: 'crisis educativa', weight: 4 },
      { phrase: 'migration perceptions', weight: 5 }, { phrase: 'perceptions', weight: 3 },
      { phrase: 'migration survey', weight: 5 }, { phrase: 'reinsertion', weight: 3 },
      { phrase: 'reinsercion', weight: 3 }, { phrase: 'reintegration', weight: 3 },
      { phrase: 'lectora', weight: 2 }, { phrase: 'pensamiento pedagogico', weight: 4 },
      { phrase: 'educacion cosmopolita', weight: 4 },
      { phrase: 'citizenship', weight: 3 }, { phrase: 'community', weight: 2 }, { phrase: 'justice', weight: 2 },
    ],
  },
];

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function includesPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${normalizeText(phrase)} `);
}

/** Return a transparent temporary suggestion only when one line clearly leads. */
export function suggestEcmcResearchLine(title: string): ResearchLineSuggestion | undefined {
  const titleText = normalizeText(title);
  const scores = DICTIONARY.map(rule => {
    const titleMatches = rule.keywords.filter(keyword => includesPhrase(titleText, keyword.phrase));
    return {
      line: rule.line,
      score: titleMatches.reduce((sum, keyword) => sum + keyword.weight, 0),
      matchedKeywords: titleMatches.map(keyword => keyword.phrase),
    };
  }).sort((left, right) => right.score - left.score);

  const [best, second] = scores;
  if (!best || best.score < 3 || best.score - (second?.score || 0) < 1.5) return undefined;

  return {
    line: best.line,
    strength: best.score >= 5 && best.score - (second?.score || 0) >= 2.5 ? 'alta' : 'media',
    matchedKeywords: best.matchedKeywords,
  };
}

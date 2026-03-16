#!/usr/bin/env node
/**
 * 롯데웰푸드_임원 과정 사전 주제도출 결과 (원본).xlsx 를
 * data/executive-strategies.json 으로 변환합니다.
 *
 * 사용: node scripts/xlsx-to-json.mjs [엑셀파일경로]
 * 기본 경로: ./롯데웰푸드_임원 과정 사전 주제도출 결과 (원본).xlsx
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let xlsx;
try {
  xlsx = (await import('xlsx')).default;
} catch (e) {
  console.error('xlsx 패키지가 필요합니다. npm install xlsx 실행 후 다시 시도하세요.');
  process.exit(1);
}

const inputPath = path.resolve(root, process.argv[2] || '롯데웰푸드_임원 과정 사전 주제도출 결과 (원본).xlsx');
if (!fs.existsSync(inputPath)) {
  console.error('엑셀 파일을 찾을 수 없습니다:', inputPath);
  console.error('사용법: node scripts/xlsx-to-json.mjs [엑셀파일경로]');
  process.exit(1);
}

const workbook = xlsx.readFile(inputPath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

// 컬럼 매핑: 엑셀 헤더가 다르면 여기서 수정
const colMap = {
  작성본부: '작성본부',
  제목: '제목',
  전략: '제목',
  내용: '내용',
  상세: '내용',
  요약: '요약',
  비고: '비고',
};

const strategies = [];
const departmentSet = new Set();

rows.forEach((row, i) => {
  const keys = Object.keys(row);
  const firstVal = row[keys[0]];
  if (!firstVal || String(firstVal).trim() === '') return;

  const 작성본부 = row['작성본부'] ?? row['본부'] ?? '';
  const 제목 = row['제목'] ?? row['전략'] ?? row['주제'] ?? keys.find(k => k.includes('제목') || k.includes('전략')) ? row[keys.find(k => k.includes('제목') || k.includes('전략'))] : firstVal;
  const 내용 = row['내용'] ?? row['상세'] ?? row['설명'] ?? '';
  const 요약 = row['요약'] ?? (제목 && 제목.length < 80 ? 제목 : '');

  if (작성본부) departmentSet.add(작성본부);
  strategies.push({
    id: 'strat-' + (i + 1),
    작성본부: String(작성본부).trim(),
    제목: String(제목 || firstVal).trim(),
    내용: String(내용).trim(),
    요약: String(요약 || 제목 || firstVal).trim().slice(0, 100),
  });
});

const departments = Array.from(departmentSet).filter(Boolean).sort();
const out = { departments, strategies };
const outPath = path.resolve(root, 'data', 'executive-strategies.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('저장 완료:', outPath);
console.log('본부 수:', departments.length, '| 전략 수:', strategies.length);

/**
 * 임원 AI 활용 영역 시드 데이터 (운영 시 API/설정으로 교체 가능)
 */
window.AX_SEED = {
  workshopName: '롯데웰푸드 AI 전환 과제 설계',
  executiveAreas: [
    { id: 'area-1', title: '영업·마케팅', description: 'AI 기반 고객 분석 및 캠페인' },
    { id: 'area-2', title: '제품 개발·품질관리', description: '품질 검사 자동화' },
    { id: 'area-3', title: '공급망·물류 최적화', description: '수요예측 및 재고 관리' },
    { id: 'area-4', title: '고객 서비스 고도화', description: '챗봇 및 CS 자동 응대' }
  ],
  /** ICE 평가 항목 라벨 (고객사 3문항 매핑) */
  iceLabels: {
    impact: '전략 부합도 (임원이 규명한 조직 문제 해결)',
    ease: '구현 가능성 (보안/인프라 내 구현 가능)',
    confidence: '데이터 확보성 (필요 데이터 확보 가능)'
  },
  /** 과제정의서 항목 */
  definitionFields: [
    { key: 'title', label: '과제명', type: 'text' },
    { key: 'background', label: '배경 및 목표', type: 'textarea' },
    { key: 'scope', label: '범위·수준', type: 'textarea' },
    { key: 'workflowSummary', label: '관련 워크플로우 요약', type: 'textarea' },
    { key: 'constraints', label: '제약·요건 (보안, 연동 등)', type: 'textarea' },
    { key: 'keyMan', label: 'Key Man·담당', type: 'text' },
    { key: 'dataStrategy', label: '데이터 확보 전략', type: 'textarea' },
    { key: 'securityNotes', label: '보안·인프라 메모', type: 'textarea' }
  ]
};

export function formatStageAge(daysInStage) {
  if (daysInStage === null || daysInStage === undefined) return null;
  if (daysInStage <= 0) return 'Today';
  if (daysInStage === 1) return '1 day';
  return `${daysInStage} days`;
}

export function stageAgeColor(daysInStage) {
  if (daysInStage === null || daysInStage === undefined) return 'text-gray-400';
  if (daysInStage <= 7) return 'text-green-500';
  if (daysInStage <= 14) return 'text-yellow-500';
  return 'text-red-500';
}

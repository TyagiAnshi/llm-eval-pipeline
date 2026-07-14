export function parseJudgeOutput(rawOutput) {
  if (!rawOutput) {
    return { faithfulness: 0.0, relevancy: 0.0, isHallucinating: true };
  }

  try {
    // 1. Try direct JSON parsing
    const cleaned = rawOutput.trim();
    const parsed = JSON.parse(cleaned);
    
    let faithfulness = Number(parsed.faithfulness);
    let relevancy = Number(parsed.relevancy);
    let isHallucinating = parsed.isHallucinating === true || parsed.isHallucinating === 'true';

    if (isNaN(faithfulness)) faithfulness = 0.0;
    if (isNaN(relevancy)) relevancy = 0.0;

    return { faithfulness, relevancy, isHallucinating };
  } catch (err) {
    // 2. Regex fallback if response is wrapped in markdown blocks
    try {
      const jsonMatch = rawOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        let faithfulness = Number(parsed.faithfulness);
        let relevancy = Number(parsed.relevancy);
        let isHallucinating = parsed.isHallucinating === true || parsed.isHallucinating === 'true';

        if (isNaN(faithfulness)) faithfulness = 0.0;
        if (isNaN(relevancy)) relevancy = 0.0;

        return { faithfulness, relevancy, isHallucinating };
      }
    } catch (regexErr) {
      // Ignore and fallback
    }

    // 3. Absolute fallback
    return { faithfulness: 0.0, relevancy: 0.0, isHallucinating: true };
  }
}

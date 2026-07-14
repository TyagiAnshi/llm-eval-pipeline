export function parseJudgeOutput(rawOutput) {
  if (!rawOutput) {
    console.warn("⚠️ Judge Output is empty or null.");
    return { faithfulness: 0.0, relevancy: 0.0, isHallucinating: true };
  }

  const clamp = (val) => Math.min(1.0, Math.max(0.0, val));

  try {
    // 1. Try direct JSON parsing (Primary path for Gemini structured outputs)
    const cleaned = rawOutput.trim();
    const parsed = JSON.parse(cleaned);
    
    let faithfulness = Number(parsed.faithfulness);
    let relevancy = Number(parsed.relevancy);
    let isHallucinating = parsed.isHallucinating === true || parsed.isHallucinating === 'true';

    if (isNaN(faithfulness)) faithfulness = 0.0;
    if (isNaN(relevancy)) relevancy = 0.0;

    return {
      faithfulness: clamp(faithfulness),
      relevancy: clamp(relevancy),
      isHallucinating
    };
  } catch (err) {
    // 2. Regex fallback (Documented last-resort net if response is wrapped in markdown formatting blocks)
    try {
      const jsonMatch = rawOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        let faithfulness = Number(parsed.faithfulness);
        let relevancy = Number(parsed.relevancy);
        let isHallucinating = parsed.isHallucinating === true || parsed.isHallucinating === 'true';

        if (isNaN(faithfulness)) faithfulness = 0.0;
        if (isNaN(relevancy)) relevancy = 0.0;

        return {
          faithfulness: clamp(faithfulness),
          relevancy: clamp(relevancy),
          isHallucinating
        };
      }
    } catch (regexErr) {
      // Fall through to absolute failure log
    }

    // 3. Absolute fallback with detailed warning log
    console.warn("⚠️ Judge Output Parsing Failed. Raw Response:", rawOutput);
    return { faithfulness: 0.0, relevancy: 0.0, isHallucinating: true };
  }
}

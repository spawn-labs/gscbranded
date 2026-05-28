import { getBusinessUnitKeywordMap } from "../../lib/google";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const map = getBusinessUnitKeywordMap(context.env);
  const units = Object.entries(map).map(([id, keywords]) => ({
    id,
    label: id,
    keywordCount: keywords.length,
  }));

  return Response.json({ units });
};

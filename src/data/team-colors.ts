const TEAM_ACCENT_COLORS: Record<string, string> = {
  atl: "#E03A3E",
  bkn: "#818893",
  bos: "#007A33",
  cha: "#1D1160",
  chi: "#CE1141",
  cle: "#860038",
  dal: "#00538C",
  den: "#0E2240",
  det: "#C8102E",
  gsw: "#1D428A",
  hou: "#CE1141",
  ind: "#002D62",
  lac: "#C8102E",
  lal: "#552583",
  mem: "#5D76A9",
  mia: "#98002E",
  mil: "#00471B",
  min: "#0C2340",
  nop: "#B4975A",
  nyk: "#006BB6",
  okc: "#007AC1",
  orl: "#0077C0",
  phi: "#002B5C",
  phx: "#E56020",
  por: "#E03A3E",
  sac: "#5A2D81",
  sas: "#8A8D8F",
  tor: "#CE1141",
  uta: "#002B5C",
  was: "#E31837"
};

const DEFAULT_TEAM_ACCENT_COLOR = "#5e6ad2";

export function getTeamAccentColor(teamId: string) {
  return TEAM_ACCENT_COLORS[teamId] ?? DEFAULT_TEAM_ACCENT_COLOR;
}

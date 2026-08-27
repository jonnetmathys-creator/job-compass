// Thème de carte vectorielle (Protomaps) aux couleurs JobCompass.
// Rendu côté navigateur sur canvas (léger, reste dans Leaflet). On dérive le
// flavor LIGHT de @protomaps/basemaps et on n'écrase que les couleurs utiles
// pour coller à la charte (palette + Montserrat), plus les libellés en français.
//
// La clé Protomaps est publique (client) : préfixe NEXT_PUBLIC_. Sans clé, on
// renvoie null et l'appelant retombe sur le fond raster Esri.
import { leafletLayer, paintRules, labelRules } from 'protomaps-leaflet'
import { LIGHT, type Flavor } from '@protomaps/basemaps'

export const PROTOMAPS_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_KEY ?? ''
export const PROTOMAPS_URL = `https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=${PROTOMAPS_KEY}`

// Palette (src/app/globals.css) : vert #2e9e5b, soft #e7f5ec, encre #1c1e21,
// gris #6b7280, fond #fbfbfa.
export function flavorJobCompass(famille: string): Flavor {
  return {
    ...LIGHT,
    background: '#fbfbfa',
    earth: '#fbfbf8', // blanc cassé chaud (épuré)
    water: '#e8ebee', // gris neutre, surtout PAS vert
    // Occupation des sols : à bas zoom le flavor LIGHT peint tout en vert. On
    // aplatit vers du blanc cassé (Positron), avec juste un soupçon de vert sur
    // les forêts pour un rappel discret de la marque.
    landcover: {
      grassland: '#f4f7f3', farmland: '#f5f7f2', forest: '#edf4ee',
      scrub: '#f2f5f0', barren: '#f6f5f2', urban_area: '#f0f1ef', glacier: '#ffffff',
    },
    // Espaces verts (zoom rapproché) : teinte discrète (épuré).
    park_a: '#eaf4ee', park_b: '#e6f1ea',
    wood_a: '#eef5f0', wood_b: '#eaf3ed',
    scrub_a: '#f1f6f1', scrub_b: '#eef4ee',
    // Bâti : un poil plus marqué que la terre pour donner de la définition au zoom
    // (pas de 3D possible en rendu canvas, contrairement au WebGL).
    buildings: '#e9e9e6',
    pedestrian: '#f4f4f2',
    industrial: '#f2f1ee', school: '#f3f2ef', hospital: '#f5f1f1',
    // Routes : blanc + liserés gris clair, minimal.
    minor_service: '#ffffff', minor_a: '#ffffff', minor_b: '#ffffff', link: '#ffffff',
    minor_service_casing: '#ececec', minor_casing: '#ececec', link_casing: '#e6e3de',
    other: '#f4f4f2',
    major: '#f7f5f2', major_casing_early: '#e6e3de', major_casing_late: '#e6e3de',
    highway: '#efe9df', highway_casing_early: '#ddd8d0', highway_casing_late: '#ddd8d0',
    railway: '#dcdee1',
    boundaries: '#c9ced4',
    // Libellés : noms de villes en vert marque JobCompass (halo blanc pour la
    // lisibilité), le reste en gris neutre pour rester épuré.
    city_label: '#2e9e5b', city_label_halo: '#ffffff',
    subplace_label: '#6b7280', subplace_label_halo: '#ffffff',
    state_label: '#8a9096', state_label_halo: '#ffffff',
    country_label: '#3a3d42',
    roads_label_major: '#6b7280', roads_label_major_halo: '#ffffff',
    roads_label_minor: '#9aa0a7', roads_label_minor_halo: '#ffffff',
    address_label: '#9aa0a7', address_label_halo: '#ffffff',
    ocean_label: '#9db4c7',
    // Police des libellés : la famille Montserrat déjà chargée par l'app.
    regular: famille, bold: famille,
  }
}

// Construit le fond Protomaps stylé, ou null si aucune clé (repli Esri géré par
// l'appelant). `famille` = font-family Montserrat résolue (getComputedStyle),
// pour que le rendu canvas utilise bien la police de l'app.
// Filtre d'importance : le jeu de libellés par défaut affiche TOUS les lieux
// (villes, mais aussi hameaux et lieux-dits « La Violette »...) dès qu'ils sont
// dans la tuile, ce qui sature la carte au zoom. On ne garde que ce qui a du sens
// au niveau de zoom courant, façon Positron. Signature du filtre : (zoom, feature).
// Zoom d'apparition d'un lieu selon son rang de population (fourni par Protomaps :
// ~10 métropole, 8 grande ville, 7 banlieue, 5-6 petit bourg). Le `min_zoom` seul
// ne suffit pas (tous les bourgs partagent la même valeur et surgissent d'un coup).
// On échelonne donc façon Positron : grandes villes tôt, bourgs de plus en plus
// tard. Baisse un seuil pour montrer cette catégorie plus tôt, monte-le pour plus tard.
function seuilZoomParRang(rang: number): number {
  if (rang >= 11) return 4 // très grandes métropoles (Paris, Lyon…)
  if (rang >= 10) return 5 // grandes métropoles (Nantes)
  if (rang >= 9) return 6
  if (rang >= 8) return 8 // grandes villes (Saint-Nazaire ~75k)
  if (rang >= 7) return 10 // villes moyennes / banlieues (~20-45k)
  if (rang >= 6) return 11
  if (rang >= 5) return 12
  if (rang >= 4) return 13
  return 14
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function libelleLieuVisible(z: number, f: any): boolean {
  const p = f.props ?? {}
  if (p.kind !== 'locality') return true // pays / régions : inchangés
  if (typeof p.population_rank === 'number' && p.population_rank > 0) {
    return z >= seuilZoomParRang(p.population_rank)
  }
  // Repli si le rang manque (lieux-dits) : via min_zoom, révélé tard.
  const mz = typeof p.min_zoom === 'number' ? p.min_zoom : 13
  return z >= mz + 2
}

// Construit une couche Protomaps à partir de N'IMPORTE QUEL flavor, en appliquant
// le filtre d'importance des libellés. Utilisé par le fond de l'app et par la page
// de comparaison des ambiances.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fondDepuisFlavor(flavor: Flavor, extra: Record<string, unknown> = {}): any {
  const regles = labelRules(flavor, 'fr').map((r) => {
    if (r.dataLayer !== 'places') return r
    const base = r.filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ...r, filter: (z: number, feat: any) => (!base || base(z, feat)) && libelleLieuVisible(z, feat) }
  })
  return leafletLayer({
    url: PROTOMAPS_URL,
    paintRules: paintRules(flavor),
    labelRules: regles,
    backgroundColor: flavor.background,
    maxDataZoom: 15,
    attribution: '© <a href="https://protomaps.com">Protomaps</a> © OpenStreetMap',
    ...extra,
  })
}

// Fond stylé JobCompass, ou null si aucune clé (repli Esri géré par l'appelant).
// `famille` = font-family Montserrat résolue (getComputedStyle), pour que le rendu
// canvas utilise bien la police de l'app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fondProtomaps(famille: string, extra: Record<string, unknown> = {}): any {
  if (!PROTOMAPS_KEY) return null
  return fondDepuisFlavor(flavorJobCompass(famille), extra)
}

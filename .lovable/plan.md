## Dokončanje prevoda

Po pregledu kode je večina aplikacije že prevedena. Ostaja le nekaj zaostalih nizov:

### Toast sporočila (slovenska, niso prevedena)
- `src/pages/Index.tsx`
  - vr. 119: "Napaka pri nalaganju članstva"
  - vr. 196: "Napaka pri nalaganju udeležencev"
- `src/pages/Players.tsx`
  - vr. 104: "Nimate več dostopa do te lige"
  - vr. 328: "Ocena uspešno shranjena"
- `src/components/MatchCard.tsx`
  - vr. 285: `Uspešno odstranjenih ${n} igralcev`
  - vr. 354: `Uspešno spremenjenih ${n} pozicij`

### Oznake / labels
- `src/pages/MatchDetails.tsx` vr. 441: oznaka algoritma `"Serpentine (Kača)"` → uporabiti `t()`
- `src/pages/MatchDetails.tsx` vr. 702 "Počisti ekipe", vr. 804 "Prekliči", vr. 817 "Prekliči rezultate in odpri tekmo", vr. 850 "Povprečje:" → uporabiti `t()`

### Kar OSTANE v slovenščini (namerno)
DB vrednosti, ki se uporabljajo kot ključi v bazi in ne smejo biti prevedeni:
- `"igralec"`, `"vratar"` (positions)
- `"plačan_član"`, `"neplačan_član"`, `"poskusni_član"` (role keys)
- `"hokej"`, `"nogomet"`, `"košarka"`, `"odbojka"` (sport keys)
- `"Ročno"`, `"redni_del"`, `"kazenski_streli"` (DB enum vrednosti)

Za prikaz teh vrednosti se uporabljajo ločeni label-getterji (npr. `getPositionLabel`, `sportConfig.label`), ki so že povezani z i18n kjer je smiselno.

### Implementacijski koraki
1. Dodati ~8 novih ključev v `src/lib/i18n.tsx` (sl/en/de) za zgornje nize, vključno z interpolacijo `{count}` za MatchCard toaste.
2. Zamenjati hardcoded slovenske nize z `t("...")` klici v zgoraj naštetih datotekah.
3. V MatchDetails.tsx pri prikazu imena algoritma uporabiti že obstoječ prevod (`md.algoSerpentine`) namesto literala.
4. Hitro preveriti preview, da v vseh treh jezikih ni več slovenskih ostankov.

Ne bom spreminjal DB enumov, business logike ali UI postavitve — zgolj besedilne nize.
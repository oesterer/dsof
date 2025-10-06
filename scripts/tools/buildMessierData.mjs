const raw = `
M1|Crab Nebula|supernova_remnant|05 34 32|+22 01 00
M2|NGC 7089|globular_cluster|21 33 28|-00 49 24
M3|NGC 5272|globular_cluster|13 42 12|+28 23 00
M4|NGC 6121|globular_cluster|16 23 35|-26 31 32
M5|NGC 5904|globular_cluster|15 18 33|+02 04 51
M6|Butterfly Cluster|open_cluster|17 40 20|-32 15 12
M7|Ptolemy Cluster|open_cluster|17 53 51|-34 47 00
M8|Lagoon Nebula|nebula|18 03 37|-24 23 13
M9|NGC 6333|globular_cluster|17 19 11|-18 30 58
M10|NGC 6254|globular_cluster|16 57 09|-04 05 58
M11|Wild Duck Cluster|open_cluster|18 51 05|-06 16 12
M12|NGC 6218|globular_cluster|16 47 14|-01 56 55
M13|Hercules Cluster|globular_cluster|16 41 41|+36 27 36
M14|NGC 6402|globular_cluster|17 37 36|-03 14 45
M15|Great Pegasus Cluster|globular_cluster|21 29 58|+12 10 01
M16|Eagle Nebula|nebula|18 18 48|-13 49 00
M17|Omega Nebula|nebula|18 20 26|-16 10 36
M18|NGC 6613|open_cluster|18 19 58|-17 06 06
M19|NGC 6273|globular_cluster|17 02 38|-26 16 04
M20|Trifid Nebula|nebula|18 02 23|-23 01 48
M21|NGC 6531|open_cluster|18 04 13|-22 29 24
M22|Sagittarius Cluster|globular_cluster|18 36 24|-23 54 12
M23|NGC 6494|open_cluster|17 56 54|-19 01 48
M24|Sagittarius Star Cloud|nebula|18 17 00|-18 29 00
M25|IC 4725|open_cluster|18 31 47|-19 06 54
M26|NGC 6694|open_cluster|18 45 18|-09 23 00
M27|Dumbbell Nebula|planetary_nebula|19 59 36|+22 43 16
M28|NGC 6626|globular_cluster|18 24 33|-24 52 11
M29|Cooling Tower Cluster|open_cluster|20 23 57|+38 30 30
M30|NGC 7099|globular_cluster|21 40 22|-23 10 44
M31|Andromeda Galaxy|galaxy|00 42 44|+41 16 09
M32|NGC 221|galaxy|00 42 42|+40 51 55
M33|Triangulum Galaxy|galaxy|01 33 51|+30 39 37
M34|Spiral Cluster|open_cluster|02 42 06|+42 45 42
M35|NGC 2168|open_cluster|06 08 54|+24 20 00
M36|Pinwheel Cluster|open_cluster|05 36 18|+34 08 24
M37|Starfish Cluster|open_cluster|05 52 18|+32 33 12
M38|NGC 1912|open_cluster|05 28 42|+35 50 54
M39|NGC 7092|open_cluster|21 31 48|+48 26 00
M40|Winnecke 4|open_cluster|12 22 12|+58 05 00
M41|NGC 2287|open_cluster|06 46 00|-20 45 00
M42|Orion Nebula|nebula|05 35 17|-05 23 28
M43|De Mairan's Nebula|nebula|05 35 31|-05 16 02
M44|Beehive Cluster|open_cluster|08 40 24|+19 40 00
M45|Pleiades|open_cluster|03 47 24|+24 07 00
M46|NGC 2437|open_cluster|07 41 46|-14 48 36
M47|NGC 2422|open_cluster|07 36 36|-14 29 00
M48|NGC 2548|open_cluster|08 13 48|-05 45 00
M49|NGC 4472|galaxy|12 29 47|+08 00 02
M50|NGC 2323|open_cluster|07 02 42|-08 23 00
M51|Whirlpool Galaxy|galaxy|13 29 52|+47 11 43
M52|NGC 7654|open_cluster|23 24 48|+61 35 36
M53|NGC 5024|globular_cluster|13 12 55|+18 10 09
M54|NGC 6715|globular_cluster|18 55 03|-30 28 42
M55|NGC 6809|globular_cluster|19 39 59|-30 57 44
M56|NGC 6779|globular_cluster|19 16 35|+30 11 01
M57|Ring Nebula|planetary_nebula|18 53 35|+33 01 45
M58|NGC 4579|galaxy|12 37 43|+11 49 05
M59|NGC 4621|galaxy|12 42 02|+11 38 49
M60|NGC 4649|galaxy|12 43 40|+11 33 10
M61|NGC 4303|galaxy|12 21 55|+04 28 25
M62|NGC 6266|globular_cluster|17 01 13|-30 06 44
M63|Sunflower Galaxy|galaxy|13 15 49|+42 01 45
M64|Black Eye Galaxy|galaxy|12 56 44|+21 40 58
M65|NGC 3623|galaxy|11 18 56|+13 05 32
M66|NGC 3627|galaxy|11 20 15|+12 59 30
M67|NGC 2682|open_cluster|08 51 18|+11 49 00
M68|NGC 4590|globular_cluster|12 39 28|-26 44 36
M69|NGC 6637|globular_cluster|18 31 23|-32 20 57
M70|NGC 6681|globular_cluster|18 43 13|-32 17 31
M71|NGC 6838|globular_cluster|19 53 47|+18 46 45
M72|NGC 6981|globular_cluster|20 53 28|-12 32 28
M73|Aquarius Asterism|open_cluster|20 59 00|-12 38 00
M74|Phantom Galaxy|galaxy|01 36 42|+15 47 00
M75|NGC 6864|globular_cluster|20 06 05|-21 55 17
M76|Little Dumbbell Nebula|planetary_nebula|01 42 19|+51 34 31
M77|Cetus A|galaxy|02 42 40|-00 00 48
M78|NGC 2068|nebula|05 46 46|+00 03 00
M79|NGC 1904|globular_cluster|05 24 11|-24 31 27
M80|NGC 6093|globular_cluster|16 17 02|-22 58 30
M81|Bode's Galaxy|galaxy|09 55 33|+69 03 55
M82|Cigar Galaxy|galaxy|09 55 52|+69 40 47
M83|Southern Pinwheel|galaxy|13 37 00|-29 51 56
M84|NGC 4374|galaxy|12 25 03|+12 53 13
M85|NGC 4382|galaxy|12 25 24|+18 11 15
M86|NGC 4406|galaxy|12 26 12|+12 56 45
M87|Virgo A|galaxy|12 30 49|+12 23 28
M88|NGC 4501|galaxy|12 31 59|+14 25 13
M89|NGC 4552|galaxy|12 35 39|+12 33 23
M90|NGC 4569|galaxy|12 36 50|+13 09 46
M91|NGC 4548|galaxy|12 35 27|+14 29 46
M92|NGC 6341|globular_cluster|17 17 07|+43 08 12
M93|NGC 2447|open_cluster|07 44 30|-23 52 00
M94|Cat's Eye Galaxy|galaxy|12 50 53|+41 07 12
M95|NGC 3351|galaxy|10 43 57|+11 42 13
M96|NGC 3368|galaxy|10 46 46|+11 49 12
M97|Owl Nebula|planetary_nebula|11 14 48|+55 01 08
M98|NGC 4192|galaxy|12 13 48|+14 54 01
M99|NGC 4254|galaxy|12 18 50|+14 24 59
M100|NGC 4321|galaxy|12 22 55|+15 49 21
M101|Pinwheel Galaxy|galaxy|14 03 13|+54 20 57
M102|Spindle Galaxy|galaxy|15 06 31|+55 45 47
M103|NGC 581|open_cluster|01 33 23|+60 39 00
M104|Sombrero Galaxy|galaxy|12 39 59|-11 37 23
M105|NGC 3379|galaxy|10 47 49|+12 34 54
M106|NGC 4258|galaxy|12 18 57|+47 18 14
M107|NGC 6171|globular_cluster|16 32 32|-13 03 13
M108|NGC 3556|galaxy|11 11 31|+55 40 26
M109|NGC 3992|galaxy|11 57 36|+53 22 28
M110|NGC 205|galaxy|00 40 22|+41 41 07
`;

function parseRa(value) {
  const [hh, mm, ss] = value.split(' ').map((part) => parseInt(part, 10));
  return hh + mm / 60 + ss / 3600;
}

function parseDec(value) {
  const parts = value.split(' ');
  const sign = parts[0].startsWith('-') ? -1 : 1;
  const deg = Math.abs(parseInt(parts[0], 10));
  const min = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  const sec = parts.length > 2 ? parseInt(parts[2], 10) : 0;
  const decimal = deg + min / 60 + sec / 3600;
  return sign * decimal;
}

const objects = raw
  .trim()
  .split('\n')
  .map((line) => {
    const [designation, name, type, raStr, decStr] = line.split('|');
    const raHours = parseFloat(parseRa(raStr).toFixed(4));
    const decDeg = parseFloat(parseDec(decStr).toFixed(4));
    return { designation, name, type, raHours, decDeg };
  });

const json = JSON.stringify(objects, null, 2).replace(/"([a-zA-Z0-9_]+)":/g, '$1:');

const output = `export const MESSIER_OBJECTS = ${json};\n`;

console.log(output);

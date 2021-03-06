/*
  @flow
 */

import * as ivCalculator from 'pokemon-go-iv-calculator';
import { padLeft } from './string-utils';

import pokemonData from '../data/pokemon_game_data.json';
import levelData from '../data/level_game_data.json';

export function findPokemonInGameData(pokemonName: string){
  let search = pokemonData.filter( p => p.Name === pokemonName)
  if(search){
    return {
      ...search[0],
      avatar: getPokemonImageUrl(search[0].PkMn)
    };
  }else{
    throw new Error(`Pokemon ${pokemonName} not found`);
  }
}

export function findPokemonInGameDataById(pokemonId: number){
  let search = pokemonData.filter( p => p.PkMn === +pokemonId)
  if(search){
    return {
      ...search[0],
      avatar: getPokemonImageUrl(search[0].PkMn)
    };
  }else{
    throw new Error(`Pokemon with id ${pokemonId} not found`);
  }
}

function findCpScalarPerLevel(level){
  let search = levelData.filter( l => l.level === level);
  if(search){
    return search[0].cpScalar;
  }
  return 0;
}

function findLevelRangePerDust(dust){
  let search = levelData.filter( l => l.dust === dust)
    .map( l => l.level);
  if(search){
    return search;
  }
  return [];
}

function calcCP(baseAttack, attackIV, baseDefense, defenseIV, baseStamina, staminaIV, cpScalar){
  let cp = (baseAttack + attackIV) * Math.sqrt(baseDefense + defenseIV) * Math.sqrt(baseStamina + staminaIV) * Math.pow(cpScalar,2)
  cp = Math.floor(cp/10);
  return cp;
}

function calcHP(baseStamina, staminaIV, cpScalar){
  return Math.floor((baseStamina + staminaIV) * cpScalar);
}

function calcPerfection(attackIV, defenseIV, staminaIV){
  return roundPercent((attackIV + defenseIV + staminaIV)/45);
}

function calculateStats(pokemonData, attackIV, defenseIV, staminaIV, level){
  let baseStamina = pokemonData['Base Stamina'];
  let baseAttack = pokemonData['Base Attack'];
  let baseDefense = pokemonData['Base Defense'];
  let cpScalar = findCpScalarPerLevel(level);
  let maxCpScalar = findCpScalarPerLevel(80);
  let hp = calcHP(baseStamina, staminaIV, cpScalar);
  let cp = calcCP(baseAttack, attackIV, baseDefense, defenseIV, baseStamina, staminaIV, cpScalar);
  let maxCp = calcCP(baseAttack, attackIV, baseDefense, defenseIV, baseStamina, staminaIV, maxCpScalar);
  let maxHp = calcHP(baseStamina, staminaIV, maxCpScalar);
  let perfection = calcPerfection(attackIV, defenseIV, staminaIV);
  return {
    attackIV,
    defenseIV,
    staminaIV,
    level,
    perfection,
    hp,
    cp,
    maxCp,
    maxHp
  }
}

function roundPercent(num){
  return (100*num).toFixed(0);
}

function findEvolutions(evolutions){
  let ids = (evolutions+"").split(",").map( id => id.trim());
  return ids.map(findPokemonInGameDataById);
}

export function guessPokemonLevel(pokemonName: string, cp: number){
  for(let lvl = 1; lvl <= 80; lvl++){
      let range = calcCPRange(pokemonName, lvl);
      if(range.minCp <= cp && range.maxCp >= cp){
        return lvl;
      }
  }
  return null;
}

export function calcCPRange(pokemonName: string, lvl: number, cp?: number){
  let pokemon = findPokemonInGameData(pokemonName);
  let range = { };
  let evolutions = [];
  if(lvl){
    let worstCase = calculateStats(pokemon, 5, 5, 5, lvl);
    let bestCase = calculateStats(pokemon, 10, 10, 10, lvl);
    range = { minCp: worstCase.cp, maxCp: bestCase.cp };
    let evoIds = pokemon["Evolution"];
    if(evoIds){
      evolutions = findEvolutions(evoIds).map( evo => calcCPRange(evo.Name, lvl));
    }
  }
  return { pokemon, evolutions, ...range, lvl, cp };
}

export function generatePokemonResume(pokemonName: string, cp: number, hp: number, dust: number){
  let pokemon = findPokemonInGameData(pokemonName);
  if(pokemonName === 'Nidoran♀'){
    pokemonName = 'Nidoran_Female';
  }
  if(pokemonName === 'Nidoran♂'){
    pokemonName = 'Nidoran_Male'
  }
  let ivsResults = ivCalculator.evaluate(pokemonName,
                parseInt(cp,10),
                parseInt(hp,10),
                parseInt(dust,10));
  let best, worst;
  let avgPerfection;
  let perfection = {};
  let chartData = [];
  let ivs = {
    count: 0
  };
  let lvlRange = findLevelRangePerDust(dust);
  if(ivsResults.ivs.length){
    let sortedIvs = ivsResults.ivs.sort( (a,b) => b.perfection-a.perfection);
    if(sortedIvs.length > 1){
      best = sortedIvs[0];
      worst = sortedIvs[sortedIvs.length-1];
    }else{
      best = worst = sortedIvs[0];
    }
    avgPerfection = sortedIvs.reduce( (s,v) => v.perfection+s , 0)/sortedIvs.length;
    perfection = {
      best: roundPercent(best.perfection),
      worst: roundPercent(worst.perfection),
      avg: roundPercent(avgPerfection)
    }
    chartData = [
      { stat: '⚔', best: best.attackIV, worst: worst.attackIV },
      { stat: '🛡', best: best.defenseIV, worst: worst.defenseIV },
      { stat: '💪', best: best.staminaIV, worst: worst.staminaIV }
    ];
    let bestLvl = lvlRange[lvlRange.length-1];
    let worstLvl = lvlRange[0];
    ivs = {
      best: calculateStats(pokemon,15,15,15,bestLvl),
      your_best: calculateStats(pokemon, best.attackIV, best.defenseIV, best.staminaIV, best.level),
      your_worst: calculateStats(pokemon, worst.attackIV, worst.defenseIV, worst.staminaIV, worst.level),
      worst: calculateStats(pokemon,0,0,0,worstLvl),
      count: ivsResults.ivs.length
    }
  }
  return {
    pokemon,
    lvlRange,
    chartData,
    grade: ivsResults.grade,
    perfection,
    ivs
  }
}

type ImageSize = 'thumb' | 'medium' | 'full';
type ImageType = 'real' | 'cartoon';

export function getPokemonImageUrl(id: number | string, size: ImageSize = 'thumb',type: ImageType = "real"): string{
  let pokemonId = padLeft(id,3);
  let avatar = `https://storage.googleapis.com/poketrainers-b1785.appspot.com/pokemons/${type}/${size}/${pokemonId}.png`;
  return avatar;
}

const XP_PER_EVOLUTION = 500;
const TIME_PER_EVOLUTION = 24;

type PokemonResumeOptions = {
  pokemonName: string,
  quantity: number,
  candies: number,
  transfer?: boolean
};

type PokemonCandyResume = {
  pokemon: any,
  quantity: number,
  candies: number,
  xp: number,
  xpWithLuckyEgg: number,
  pokemonsToEvolve: number,
  pokemonsToTransfer: number,
  evolutionsToTransfer: number,
  candiesLeft: number,
  pokemonsLeft: number,
  time: number
};

export function getPokemonCandyResume(options: PokemonResumeOptions): PokemonCandyResume{

  let { pokemonName, quantity, candies, transfer } = options;

  let originalQuantity = quantity;

  let pokemon = findPokemonInGameData(pokemonName);
  let candiesToEvolve = pokemon["Candy To Evolve"];

  let pokemonsToEvolve = Math.floor(candies/candiesToEvolve);
  let pokemonsToTransfer = 0;
  let evolutionsToTransfer = 0;
  let candiesLeft = 0;
  if(quantity >= pokemonsToEvolve){
    quantity -= pokemonsToEvolve;

    candiesLeft = candies - (pokemonsToEvolve*candiesToEvolve);
    //Recover 1 candy for each evolution
    candiesLeft += pokemonsToEvolve;

    if(quantity > 0){
      let extraPokemonsToEvolve = Math.floor(candiesLeft/candiesToEvolve);
      candiesLeft -= (extraPokemonsToEvolve*candiesToEvolve);
      pokemonsToEvolve += extraPokemonsToEvolve;
      quantity -= extraPokemonsToEvolve;
    }

    if(quantity > candiesToEvolve){
      let possibleEvolutions = Math.floor(quantity/(candiesToEvolve+1));
      pokemonsToTransfer = possibleEvolutions*candiesToEvolve;
      candiesLeft += pokemonsToTransfer;
      pokemonsToEvolve += possibleEvolutions;
      quantity -= (pokemonsToTransfer+possibleEvolutions);
      candiesLeft -= (possibleEvolutions*candiesToEvolve);
    }

    if(transfer && pokemonsToEvolve > candiesToEvolve){
      let possibleEvolutions = Math.floor(pokemonsToEvolve/candiesToEvolve);
      if(quantity >= possibleEvolutions){
        evolutionsToTransfer = possibleEvolutions*candiesToEvolve;
        candiesLeft += evolutionsToTransfer;
        pokemonsToEvolve += possibleEvolutions;
        quantity -= possibleEvolutions;
        candiesLeft -= (possibleEvolutions*candiesToEvolve);
      }
    }
  }else{
    pokemonsToEvolve = quantity;
    quantity = 0;
    candiesLeft = candies - (pokemonsToEvolve*candiesToEvolve) + pokemonsToEvolve;
  }
  let xp = XP_PER_EVOLUTION * pokemonsToEvolve;
  return {
    pokemon,
    quantity: originalQuantity,
    candies,
    xp,
    xpWithLuckyEgg: xp*2,
    pokemonsToEvolve,
    pokemonsToTransfer,
    evolutionsToTransfer,
    candiesLeft,
    pokemonsLeft: quantity,
    time: TIME_PER_EVOLUTION * pokemonsToEvolve
  }
}

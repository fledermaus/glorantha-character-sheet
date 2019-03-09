// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2019 Vivek Das Mohapatra <vivek@etla.org>
const maths = Math; // mathematicS, damnit.

var manual_buff_on    = false;
var manual_buff_val   = 0;

// this is used for inspiration, ie buffing with runes or passions
var auto_buff_on      = false;
var auto_buff_val     = 0;

// this is used when we want to tick a skill
// theoretically it should be mutually exclusive
// [or perhaps form a lifo] with auto_buff_on
// but I have chosen not to care about this.
var tick_pending      = false;

// can we delete user-defined skills?
var ui_delete_ok      = false;
// this works a little differently than the
// other two: buff_on here means the next roll
// should _create_ a buff_val

// buff_val is a one-shot buff that is consumed
// by the next applicable (skill) roll

// unlike manual and auto, these two settings
// are independent:
var one_shot_buff_on  = false;
var one_shot_buff_val = 0;

// the default colour scheme is cached here:
var colour_scheme;
var colour_remap = {};

var suppressed_keys =
    {
        'text': [],
        'uint': [],
        'uflt': [],
        'int' : [],
        'dice': [],
        'base': [],
    };

var allowed_keys =
    {
        'uint': [],
        'uflt': [],
        'int' : [],
        'dice': [],
        'base': [],
    };
// (set-fontset-font (face-attribute 'default :fontset) '(#x0e000 . #x0f8ff) "Gloranthan-Runes" nil)
const rune_glyph = { darkness:       '' ,// e000
                     water:          '' ,// e001
                     earth:          '' ,// e002
                     air:            '' ,// e003
                     'fire/sky':     '' ,// e004
                     moon:           '' ,// e005
                     chaos:          '' ,// e02c
                     movement:       '' ,// e025
                     stasis:         '' ,// e024
                     truth:          '' ,// e026
                     illusion:       '' ,// e027
                     fertility:      '' ,// e022
                     death:          '' ,// e023
                     harmony:        '' ,// e020
                     disorder:       '' ,// e021
                     man:            '' ,// e028
                     beast:          '' ,// e029
                     plant:          '' ,// e02a
                     spirit:         '' ,// e02b
                     infinity:       '' ,// e030
                     mastery:        '' ,// e031
                     magic:          '' ,// e032
                     communication:  '' ,// e033
                    'eternal-battle':'' ,// e034
                     maker:          '' ,// e035
                     luck:           '' ,// e036
                     fate:           '' ,// e037
                     light:          '' ,// e038
                     cold:           '' ,// e039
                     law:            '' ,// e03a
                     undeath:        '' ,// e03b
                     barntar:        '' ,// e03c
                     odayla:         '' ,// e03d
                     yinkin:         '' ,// e03e
                     malkion:        '' ,// e03f
                     shargash:       '' ,// e040
                     heler:          '' ,// e041
                     lightbringer:   '' ,// e042
                     god:            '' ,// e043
                     sartar:         '' ,// e050
                     pamalt:         '' ,// e051
                     hell:           '' ,// e052
                     dragonewt:      '' ,// e060
                     dragon:         '' ,// e061
                   };

const attr_map = { 'stats.con':  [ calc_max_hp, calc_healrate, calc_enc    ] ,
                   'stats.siz':  [ calc_max_hp, calc_damage,   calc_siz_sr ] ,
                   'stats.pow':  [ calc_max_hp, calc_mp,       calc_sp_dam ] ,
                   'stats.cha':  [ calc_sp_dam ] ,
                   'stats.str':  [ calc_damage, calc_enc ] ,
                   'stats.dex':  [ calc_dex_sr ] ,
                   'derived.hp':          [ update_hitpoints ] ,
                   'hitpoints.head.cur':  [ update_hitpoints ] ,
                   'hitpoints.chest.cur': [ update_hitpoints ] ,
                   'hitpoints.armr.cur':  [ update_hitpoints ] ,
                   'hitpoints.arml.cur':  [ update_hitpoints ] ,
                   'hitpoints.body.cur':  [ update_hitpoints ] ,
                   'hitpoints.legl.cur':  [ update_hitpoints ] ,
                   'hitpoints.legr.cur':  [ update_hitpoints ] };

var extn_template =
{
    skill:   { save:   add_new_skill,
               draw:   draw_default_input_form,
               fields: [ { name: 'skill', type: 'text' } ,
                         { name: 'base',  type: 'base' } ,
                         { name: 'level', type: 'uint' } ] },
    emotion: { save:   add_new_emotion,
               draw:   draw_default_input_form,
               fields: [ { name: 'type',
                           type: ['hate','love','loyalty','devotion','fear'] },
                         { name: 'subject', type: 'text' } ,
                         { name: 'level',   type: 'uint' } ] },
    rp:      { save:   add_new_rp,
               draw:   draw_default_input_form,
               fields: [ { name: 'deity',  type: 'text' } ,
                         { name: 'points', type: 'uint' } ] },
    rmagic:  { save:   add_new_runespell,
               draw:   draw_default_input_form,
               fields: [ { name: 'name' , type: 'text'                   } ,
                         { name: 'cult' ,
                           type: function (i) { return rune_cults( i ) } } ,
                         { name: 'runes', type: 'runes', multi: true     } ,
                         { name: 'cost' , type: 'uint'                   } ] },
    misc:    { save:   add_new_misc,
               draw:   draw_default_input_form,
               fields: [ { name: 'label'     , type: 'text' } ,
                         { name: 'quantity'  , type: 'uint' } ,
                         { name: 'value/each', type: 'uflt' } ] },
    // rune:    { save: add_new_rune,
    //            draw: draw_rune_input_form,
    //            fields: [ { name: 'label', type: 'text' } ,
    //                      { name: 'glyph', type: 'text' } ,
    //                      { name: 'level', type: 'uint' } ] },
    melee:   { save: add_new_weapon,
               draw: draw_weapon_input_form,
               fields: [ { name: 'skill' , type: 'text' } ,
                         { name: 'class' ,
                           type: function (i) { return weapon_classes( i, 'melee' ); } },
                         { name: 'hands' , type: [1, 2] } ,
                         { name: 'str'   , type: 'uint' } ,
                         { name: 'dex'   , type: 'uint' } ,
                         { name: 'dam'   , type: 'dice' } ,
                         { name: 'sr'    , type: 'uint' } ,
                         { name: 'type'  ,
                           type: [ 'S:Slashing'     ,
                                   'SI:Slash+Impale',
                                   'I:Impale'       ,
                                   'C:Crush'        ]   } ,
                         { name: 'base' ,  type: 'uint' } ,
                         { name: 'level',  type: 'uint' } ] },
    missile:   { save: add_new_weapon,
                 draw: draw_weapon_input_form,
                 fields: [ { name: 'skill' , type: 'text' } ,
                           { name: 'class' ,
                             type: function (i) { return weapon_classes( i, 'missile' ); } },
                           { name: 'hands' , type: [1, 2] } ,
                           { name: 'str'   , type: 'uint' } ,
                           { name: 'dex'   , type: 'uint' } ,
                           { name: 'dam'   , type: 'dice' } ,
                           { name: 'sr'    , type: 'uint' } ,
                           { name: 'type'  ,
                             type: [ 'S:Slashing' ,
                                     'I:Impale'   ,
                                     'C:Crush'    ]       } ,
                           { name: 'base' ,  type: 'uint' } ,
                           { name: 'level',  type: 'uint' } ] },
    unarmed:   { save: add_new_weapon,
                 draw: draw_weapon_input_form,
                 fields: [ { name: 'skill' , type: 'text' } ,
                           { name: 'class' ,
                             type: function (i) { return weapon_classes( i, 'unarmed' ); } },
                           { name: 'hands' , type: [0, 1, 2] } ,
                           { name: 'str'   , type: 'uint' } ,
                           { name: 'dex'   , type: 'uint' } ,
                           { name: 'dam'   , type: 'dice' } ,
                           { name: 'sr'    , type: 'uint' } ,
                           { name: 'type'  ,
                             type: [ 'H:Hand-to-Hand',
                                     'SI:Slash+Impale',
                                     'S:Slashing' ,
                                     'I:Impale'   ,
                                     'C:Crush'    ]       } ,
                           { name: 'base' ,  type: 'uint' } ,
                           { name: 'level',  type: 'uint' } ] },
    shield:    { save: add_new_weapon,
                 draw: draw_weapon_input_form,
                 fields: [ { name: 'skill' , type: 'text' } ,
                           { name: 'class' ,
                             type: function (i) { return weapon_classes( i, 'shield' ); } },
                           { name: 'hands' , type: [ 1 ]  } ,
                           { name: 'str'   , type: 'uint' } ,
                           { name: 'dex'   , type: 'uint' } ,
                           { name: 'dam'   , type: 'dice' } ,
                           { name: 'sr'    , type: 'uint' } ,
                           { name: 'type'  ,
                             type: [ 'C:Crush', 'S:Slashing' ] } ,
                           { name: 'base'  ,  type: 'uint' } ,
                           { name: 'level' ,  type: 'uint' } ] },
};

var weapon_categories =
{
    melee:   { 'axe'   : true ,
               'dagger': true ,
               'sword' : true ,
               'hammer': true ,
               'mace'  : true ,
               'staff' : true ,
               'spear' : true ,
               'lasso' : true },
    missile: { bow          : true ,
               crossbow     : true ,
               atlatl       : true ,
               javelin      : true ,
               axe          : true ,
               dagger       : true ,
               rock         : true ,
               sling        : true ,
               'staff-sling': true },
    unarmed: { fist   : true ,
               grapple: true ,
               kick   : true },
    shield:  { shield : true },
};

// common weapons
var weapons =
{
    melee:
    { axe:
      [ { },
        { 'small-axe' : { str:  7, dex: 7, dam: '1d6+1', sr: 4, type: 'S', base: 10 } ,
          'battle-axe': { str: 13, dex: 7, dam: '1d8+2', sr: 3, type: 'S', base: 10 } } ,
        { 'battle-axe': { str:  9, dex: 7, dam: '1d8+2', sr: 3, type: 'S', base:  5 } ,
          'great-axe' : { str: 11, dex: 7, dam: '2d6+2', sr: 2, type: 'S', base:  5 } ,
          'dagger-axe': { str: 13, dex: 9, dam: '3d6'  , sr: 1, type: 'S', base:  5 } } ],
      dagger:
      [ { },
        { 'dagger'         : { str: 0, dex: 0, dam: '1d4+2', sr: 4, type: 'SI', base: 15 } ,
          'dagger.parrying': { str: 0, dex: 0, dam: '1d4+2', sr: 4, type: 'SI', base: 15 } ,
          'dagger.throwing': { str: 0, dex: 9, dam: '1d4'  , sr: 4, type: 'SI', base:  5 } ,
          'sickle'         : { str: 0, dex: 0, dam: '1d6+1', sr: 3, type: 'S' , base:  5 } } ,
        { } ],
      sword:
      [ { },
        { 'broadsword'  : { str:  9, dex:  7, dam: '1d8+1' , sr: 2, type: 'SI', base: 10 } ,
          'kopis'       : { str:  9, dex:  9, dam: '1d8+1' , sr: 2, type: 'S' , base: 10 } ,
          'rapier'      : { str:  7, dex: 13, dam: '1d6+1' , sr: 2, type: 'SI', base: 10 } ,
          'shortsword'  : { str:  0, dex:  0, dam: '1d6+1' , sr: 3, type: 'SI', base: 10 } } ,
        { 'greatsword'  : { str: 11, dex: 13, dam: '2d8'   , sr: 1, type: 'S' , base:  5 } ,
          'romphaia'    : { str: 11, dex:  9, dam: '2d6+2' , sr: 2, type: 'S' , base:  5 } ,
          'sickle-sword': { str:  9, dex:  9, dam: '1d10+1', sr: 2, type: 'S' , base:  5 } } ],
      hammer:
      [ { },
        { 'war-hammer'  : { str: 11, dex: 9, dam: '1d6+2', sr: 3, type: 'C', base: 10 } } ,
        { 'great-hammer': { str:  9, dex: 9, dam: '2d6+2', sr: 1, type: 'C', base:  5 } ,
          'maul':         { str: 11, dex: 7, dam: '2d8'  , sr: 1, type: 'C', base: 10 } } ],
      mace:
      [ { },
        { 'heavy-mace' : { str: 13, dex: 7, dam: '1d8+2', sr: 3, type: 'C', base: 15 } ,
          'light-mace' : { str:  7, dex: 7, dam: '1d6+2', sr: 3, type: 'C', base: 15 } ,
          'singlestick': { str:  0, dex: 9, dam: '1d6'  , sr: 4, type: 'C', base: 15 } ,
          'wooden-club': { str:  7, dex: 7, dam: '1d6'  , sr: 4, type: 'C', base: 15 } } ,
        { 'mace'       : { str:  9, dex: 7, dam: '1d8+2', sr: 3, type: 'C', base: 10 } } ],
      staff:
      [ { },
        { },
        { 'quarterstaff': { str: 9, dex: 9, dam: '1d8', sr: 0, type: 'C', base: 15 } } ],
      spear:
      [ { },
        { 'javelin'    : { str:  9, dex: 9, dam: '1d6'   , sr: 2, type: 'I', base: 10 } ,
          'short-spear': { str:  9, dex: 7, dam: '1d6+1' , sr: 2, type: 'I', base:  5 } } ,
        { 'lance'      : { str:  9, dex: 7, dam: '1d10+1', sr: 0, type: 'I', base:  5 } ,
          'pike'       : { str: 11, dex: 7, dam: '2d6+1' , sr: 0, type: 'I', base: 15 } ,
          'long-spear' : { str:  9, dex: 7, dam: '1d10+1', sr: 0, type: 'I', base: 15 } ,
          'short-spear': { str:  7, dex: 7, dam: '1d8+1' , sr: 1, type: 'I', base: 15 } } ],
    },
    missile:
    { bow:
      [ {},
        {},
        { 'composite-bow': { str: 13, dex: 9, dam: '1d8+1', type: 'I', base: 5 } ,
          'elf-bow'      : { str:  9, dex: 9, dam: '1d8+1', type: 'I', base: 5 } ,
          'self-bow'     : { str:  9, dex: 9, dam: '1d6'  , type: 'I', base: 5 } } ],
      crossbow:
      [ {},
        {},
        { 'arbalest'         : { str: 13, dex: 7, dam: '3d6+1', reload: 5, type: 'I', base: 10 } ,
          'crossbow.heavy'   : { str: 11, dex: 7, dam: '2d6+2', reload: 3, type: 'I', base: 25 } ,
          'crossbow.light'   : { str:  7, dex: 7, dam: '2d4+2', reload: 2, type: 'I', base: 25 } ,
          'cossbow.repeating': { str:  7, dex: 7, dam: '2d4+2', reload: 1, type: 'I', base: 25 } } ],
      atlatl:
      [ {},
        { 'atlatl': { str: 7, dex: 9, dam: '1+1d6', reload: 1, type: 'I', base: 5 } },
        {} ],
      javelin:
      [ {},
        { 'dart'       : { str: 0, dex: 9, dam: '1d6'  ,            type: 'I', base: 10 } ,
          'javelin'    : { str: 9, dex: 9, dam: '1d10' , reload: 1, type: 'I', base: 10 } ,
          'short-spear': { str: 9, dex: 9, dam: '1d6+1', reload: 1, type: 'I', base: 15 } },
        {} ],
      axe:    [ {}, { 'throwing-axe'   : { str: 9, dex: 9, dam: '1d6' , type: 'I', base: 10 } }, {} ],
      dagger: [ {}, { 'throwing-dagger': { str: 0, dex: 9, dam: '1d4' , type: 'I', base:  5 } }, {} ],
      rock:   [ {}, { 'rock'           : { str: 0, dex: 0, dam: '1d4' , type: 'C', base: 15 } }, {} ],
      sling:  [ {}, { 'sling'          : { str: 0, dex: 9, dam: '1d8' , type: 'C', base:  5 } }, {} ],
      'staff-sling':
      [ {},
        { 'staff-sling':  { str: 9, dex: 9, dam: '1d10', reload: 1, type: 'C', base: 10 } },
        {} ],
    },
    unarmed:
    { fist:
      [ {},
        {},
        { 'fist'         : { str:  0, dex: 0, sr: 4, dam: '1d3'  , type: 'H', base: 25 } ,
          'cestus.light' : { str:  7, dex: 0, sr: 4, dam: '1d3+1', type: 'H', base: 25 } ,
          'cestus.heavy' : { str: 11, dex: 0, sr: 4, dam: '1d3+2', type: 'H', base: 25 } ,
          'claw'         : { str:  7, dex: 9, sr: 4, dam: '1d4+1', type: 'SI',base: 25 } } ],
      grapple:
      [ {},
        {},
        { 'grapple' : { str: 0, dex: 0, sr: 4, dam: 'grapple', type: 'H', base: 25 } } ],
      kick:
      [ { 'kick'    : { str: 0, dex: 0, sr: 4, dam: '1d6', type: 'H', base: 15 } },
        {},
        {} ],
    },
    shield:
    { shield:
      [ {},
        { 'small-shield' : { str:  5, dex: 0, sr: 3, dam: '1d3', type: 'C', base: 15 } ,
          'medium-shield': { str:  9, dex: 0, sr: 3, dam: '1d4', type: 'C', base: 15 } ,
          'large-shield' : { str: 12, dex: 0, sr: 3, dam: '1d6', type: 'C', base: 15 } },
        {} ],
    },
};

const extra_ui =
{
    ticks:
    {
        label:   [ "Click" ],
        content: [ [ "span",
                     "id"   , "tick-button",
                     "class", "button exec", false, "🗹 ⋯"] ]
    },
};

var standard_skills = {};
var groups =
[
    { group: 'stats',
      label: 'Characteristics',
      draw: true,
      items: [ { key: 'str', type: 'attr', label: 'Strength',     val: 3 } ,
               { key: 'con', type: 'attr', label: 'Constitution', val: 3 } ,
               { key: 'cha', type: 'attr', label: 'Charisma',     val: 3 } ,
               { key: 'siz', type: 'attr', label: 'Size',         val: 7 } ,
               { key: 'int', type: 'attr', label: 'Intelligence', val: 7 } ,
               { key: 'pow', type: 'attr', label: 'Power',        val: 3 } ,
               { key: 'dex', type: 'attr', label: 'Dexterity',    val: 3 } ] },
    { group: 'derived',
      label: 'Derived Scores',
      draw: true,
      items: [ { key: 'srs', type: 'attr', label: 'SR Size',       val: 0  , noroll: 1, noedit: 1 } ,
               { key: 'srd', type: 'attr', label: 'SR Dex',        val: 0  , noroll: 1, noedit: 1 } ,
               { key: 'spd', type: 'dice', label: 'Spirit Damage', val: '1d3',          noedit: 1 } ,
               { key: 'dam', type: 'dice', label: 'Damage Bonus',  val: 0  ,            noedit: 1 } ,
               { key: 'mp' , type: 'attr', label: 'Magic Points',  val: 0  , noroll: 1, noedit: 1 } ,
               { key: 'hp' , type: 'attr', label: 'Hitpoints',     val: 0  , noroll: 1, noedit: 1 } ,
               { key: 'hlr', type: 'attr', label: 'Healing Rate',  val: 1  , noroll: 1, noedit: 1 } ,
               { key: 'enc', type: 'attr', label: 'Encumbrance',   val: 9  , noroll: 1, noedit: 1 } ] },
    { group: 'hitpoints',
      draw: false,
      items: [ { key: 'head.cur', type: 'attr',  val: 0 } ,
               { key: 'armr.cur', type: 'attr',  val: 0 } ,
               { key: 'chest.cur', type: 'attr', val: 0 } ,
               { key: 'body.cur', type: 'attr',  val: 0 } ,
               { key: 'arml.cur', type: 'attr',  val: 0 } ,
               { key: 'legr.cur', type: 'attr',  val: 0 } ,
               { key: 'legl.cur', type: 'attr',  val: 0 } ] },
    { group: 'armour',
      draw: false,
      items: [ { key: 'head',  type: 'attr', val: 0 } ,
               { key: 'armr',  type: 'attr', val: 0 } ,
               { key: 'chest', type: 'attr', val: 0 } ,
               { key: 'shldl', type: 'attr', val: 0 } ,
               { key: 'body',  type: 'attr', val: 0 } ,
               { key: 'shldr', type: 'attr', val: 0 } ,
               { key: 'arml',  type: 'attr', val: 0 } ,
               { key: 'legr',  type: 'attr', val: 0 } ,
               { key: 'legl',  type: 'attr', val: 0 } ,
               { key: 'all',   type: 'attr', val: 0 } ] },
    { group: 'rune',
      label: 'Runes',
      draw: true,
      extend: 'rune',
      items: [ { key: 'darkness', type: 'rune', val: 0  } ,
               { key: 'water'   , type: 'rune', val: 0  } ,
               { key: 'earth'   , type: 'rune', val: 0  } ,
               { key: 'air'     , type: 'rune', val: 0  } ,
               { key: 'fire/sky', type: 'rune', val: 0  } ,
               { key: 'moon'    , type: 'rune', val: 0  } ,
               { key: 'chaos'   , type: 'rune', val: 0  } ] },
    { group: 'prune',
      label: 'Power Runes',
      draw: true,
      items: [ { key: 'velocity'   , type: 'prune', subkeys: [ 'stasis'   , 'movement' ], val: 50 } ,
               { key: 'veracity'   , type: 'prune', subkeys: [ 'truth'    , 'illusion' ], val: 50 } ,
               { key: 'vitality'   , type: 'prune', subkeys: [ 'fertility', 'death'    ], val: 50 } ,
               { key: 'variability', type: 'prune', subkeys: [ 'harmony'  , 'disorder' ], val: 50 } ,
               { key: 'viricity'   , type: 'prune', subkeys: [ 'man'      , 'beast'    ], val: 50 } ] },
    { group: 'rp',
      label: 'Rune Points',
      draw:   true,
      extend: 'rp',
      items:  [] },
    { group: 'rune-magic',
      label: 'Rune Magic',
      draw:   true,
      extend: 'rmagic',
      items: [ ] },
    { group: 'emo',
      label: 'Passions',
      extend: 'emotion',
      draw: true,
      items: [ ] },
    { group: 'agility',
      label: 'Agility',
      draw: true,
      bonus: 0,
      extend: 'skill',
      modifier: { primary: ['dex'], secondary: ['str','pow'], penalty: ['siz'] },
      items: [ { key: 'boat',  type: 'stat', base: 5,             val: 0 } ,
               { key: 'climb', type: 'stat', base: 40,            val: 0 } ,
               { key: 'dodge', type: 'stat', base: 'stats.dex*2', val: 0 } ,
               { key: 'drive', type: 'stat', base: 5,             val: 0 } ,
               { key: 'jump',  type: 'stat', base: 'stats.dex*3', val: 0 } ,
               { key: 'ride',  type: 'stat', base: 5,             val: 0 } ,
               { key: 'swim',  type: 'stat', base: 15,            val: 0 } ] },
    { group: 'magic',
      label: 'Magic',
      draw: true,
      bonus: 0,
      extend: 'skill',
      modifier: { primary: ['pow'], secondary: ['cha'] },
      items: [ { key: 'meditate',       type: 'stat', label: "Meditate",       base: 0,  val: 0  } ,
               { key: 'prepare-corpse', type: 'stat', label: "Prepare Corpse", base: 10, val: 0  } ,
               { key: 'sense-assassin', type: 'stat', label: "Sense Assassin", base: 0,  val: 0  } ,
               { key: 'sense-chaos',    type: 'stat', label: "Sense Chaos",    base: 0,  val: 0  } ,
               { key: 'spirit-combat',  type: 'stat', label: "Spirit Combat",  base: 20, val: 0  } ,
               { key: 'spirit-dance',   type: 'stat', label: "Spirit Dance",   base: 0,  val: 0  } ,
               { key: 'spirit-lore',    type: 'stat', label: "Spirit Lore",    base: 0,  val: 0  } ,
               { key: 'spirit-travel',  type: 'stat', label: "Spirit Travel",  base: 10, val: 0  } ] },
    { group: 'communication',
      label: 'Communication',
      draw: true,
      bonus: 0,
      extend: 'skill',
      modifier: { primary: ['cha'], secondary: ['int','pow'], penalty: [] },
      items: [ { key: 'act',             type: 'stat', label: "Act",             base: 5,  val: 0  } ,
               { key: 'art',             type: 'stat', label: "Art",             base: 5,  val: 0  } ,
               { key: 'bargain',         type: 'stat', label: "Bargain",         base: 5,  val: 0  } ,
               { key: 'charm',           type: 'stat', label: "Charm",           base: 15, val: 0 } ,
               { key: 'dance',           type: 'stat', label: "Dance",           base: 10, val: 0 },
               { key: 'disguise',        type: 'stat', label: "Disguise",        base: 5,  val: 0 },
               { key: 'fast-talk',       type: 'stat', label: "Fast Talk",       base: 5,  val: 0 },
               { key: 'intimidate',      type: 'stat', label: "Intimidate",      base: 15, val: 0 },
               { key: 'intrigue',        type: 'stat', label: "Intrigue",        base: 5,  val: 0 },
               { key: 'orate',           type: 'stat', label: "Orate",           base: 10, val: 0 },
               { key: 'sing',            type: 'stat', label: "Sing",            base: 10, val: 0 },
               { key: 'speak.tradetalk', type: 'stat', label: "Speak (Tradetalk)", base: 0,  val: 0 } ,
               { key: 'speak.own',       type: 'stat', label: "Speak (Own)",     base: 50, val: 0 } ] },
    { group: 'knowledge',
      label: 'Knowledge',
      draw: true,
      bonus: 0,
      extend: 'skill',
      modifier: { primary: ['int'], secondary: ['pow'] },
      items: [ { key: 'battle',           type: 'stat', label: "Battle",           base: 10, val: 0 } ,
               { key: 'customs.own',      type: 'stat', label: "Customs (Own)",    base: 25, val: 0 } ,
               { key: 'evaluate',         type: 'stat', label: "Evaluate",         base: 5,  val: 0 } ,
               { key: 'farm',             type: 'stat', label: "Farm",             base: 5,  val: 0 } ,
               { key: 'first-aid',        type: 'stat', label: "First Aid",        base: 10, val: 0 } ,
               { key: 'game',             type: 'stat', label: "Game",             base: 15, val: 0 } ,
               { key: 'herd',             type: 'stat', label: "Herd",             base: 5,  val: 0 } ,
               { key: 'manage-household', type: 'stat', label: "Manage Household", base: 10, val: 0 } ,
               { key: 'peaceful-cut',     type: 'stat', label: "Peaceful Cut",     base: 10, val: 0 } ,
               { key: 'survival',         type: 'stat', label: "Survival",         base: 15, val: 0 } ,
               { key: 'treat-disease',    type: 'stat', label: "Treat Disease",    base: 5,  val: 0 } ,
               { key: 'treat-poison',     type: 'stat', label: "Treat Poison",     base: 5,  val: 0 } ] },
    { group: 'lore',
      label: 'Lore',
      draw: true,
      bonus: 0,
      extend: 'skill',
      modifier: { inherit: 'knowledge' },
      items: [ { key: 'animal',      type: 'stat', label: "Animal",      base: 5,  val: 0  } ,
               { key: 'celestial',   type: 'stat', label: "Celestial",   base: 5,  val: 0  } ,
               { key: 'draconic',    type: 'stat', label: "Draconic",    base: 0,  val: 0  } ,
               { key: 'elder-race',  type: 'stat', label: "Elder Race",  base: 5,  val: 0  } ,
               { key: 'homeland',    type: 'stat', label: "Homeland",    base: 30, val: 0  } ,
               { key: 'mineral',     type: 'stat', label: "Mineral",     base: 5,  val: 0  } ,
               { key: 'plant',       type: 'stat', label: "Plant",       base: 5,  val: 0  } ,
               { key: 'river',       type: 'stat', label: "River",       base: 0,  val: 0  } ,
               { key: 'underworld',  type: 'stat', label: "Underworld",  base: 0,  val: 0  } ] },
    { group: 'manipulation',
      label: 'Manipulation',
      draw: true,
      bonus: 0,
      extend: 'skill',
      modifier: { primary: ['dex','int'], secondary: ['str','pow'] },
      items: [ { key: 'conceal',         type: 'stat', label: "Conceal",         base: 5,  val: 0  } ,
               { key: 'craft',           type: 'stat', label: "Craft",           base: 10, val: 0  } ,
               { key: 'devise',          type: 'stat', label: "Devise",          base: 5,  val: 15 } ,
               { key: 'play-instrument', type: 'stat', label: "Play Instrument", base: 5, val:  5  } ,
               { key: 'sleight',         type: 'stat', label: "Sleight",         base: 5, val:  0  } ] },
    { group: 'perception',
      label: 'Perception',
      draw: true,
      bonus: 0,
      extend: 'skill',
      modifier: { primary: ['int'], secondary: ['pow'] },
      items: [ { key: 'insight.own-species',
                                 type: 'stat', label: "Insight (Own Species)",
                                                                 base: 20, val: 0 } ,
               { key: 'listen',  type: 'stat', label: "Listen",  base: 25, val: 0 } ,
               { key: 'scan',    type: 'stat', label: "Scan",    base: 25, val: 0 } ,
               { key: 'search',  type: 'stat', label: "Search",  base: 25, val: 0 } ,
               { key: 'track',   type: 'stat', label: "Track",   base: 5,  val: 0 } ] },
    { group: 'stealth',
      label: 'Stealth',
      draw: true,
      bonus: 0,
      extend: 'skill',
      modifier: { primary: ['dex','int'], secondary: ['pow'], disability: ['siz'] },
      items: [ { key: 'hide',         type: 'stat', label: "Hide",         base: 10, val: 0 } ,
               { key: 'move-quietly', type: 'stat', label: "Move Quietly", base: 10, val: 0 } ] },
    { group: 'shield',
      label: 'Shields',
      draw: true,
      bonus: 0,
      extend: 'shield',
      modifier: { inherit: 'manipulation' },
      items: [ ] },
    { group: 'unarmed',
      label: 'Natural Weapons',
      draw: true,
      bonus: 0,
      extend: 'unarmed',
      modifier: { inherit: 'manipulation' },
      items: [ ] },
    { group: 'melee',
      label: 'Melee Weapons',
      draw: true,
      bonus: 0,
      extend: 'melee',
      modifier: { inherit: 'manipulation' },
      items: [ ] },
    { group: 'missile',
      label: 'Missile Weapons',
      draw: true,
      bonus: 0,
      extend: 'missile',
      modifier: { inherit: 'manipulation' },
      items: [ ] },
    { group: 'ticks',
      label: 'Ticks',
      draw:   true  ,
      items:  []    },
    { group:  'inventory',
      label:  'Inventory',
      draw:   true,
      extend: 'misc',
      items: [ { key: 'wheels', type: 'misc', label: 'Wheels', val: 0, per: 20  } ,
               { key: 'lunars', type: 'misc', label: 'Lunars', val: 0, per: 1   } ,
               { key: 'clacks', type: 'misc', label: 'Clacks', val: 0, per: 0.1 } ] },
];

const F_MIN  = 0;
const F_MAX  = 1;
const F_LESS = 2;
const F_RULE = 3;
const F_PARRY= 4;
const fumble_results =
[
    [  1,   5, -1, "Lose next parry"                                       ],
    [  6,  10, -1, "Lose next attack"                                      ],
    [ 11,  15, -1, "Lose next attack & parry"                              ],
    [ 16,  20, -1, "Lose next attack, parry & dodge"                       ],
    [ 21,  25, -1, "Lose next {{1d3}} attacks"                             ],
    [ 26,  30, -1, "Lose next {{1d3}} attacks & parries"                   ],
    [ 31,  35, -1, "Shield strap breaks/Lose shield"                       ],
    [ 36,  40, -1, "Shield strap breaks/Lose shield & next attack"         ],
    [ 41,  45, -1, "Armour strap breaks/Lose armour from {{hit.melee}}"    ],
    [ 46,  50, -1, "Armour strap breaks/Lose armour from {{hit.melee}}/" +
                   "Lose next attack & parry"                              ],
    [ 51,  55, -1, "Fall, Lose this parry/Down for {{1d3}} rounds"         ],
    [ 56,  60, -1, "Twist ankle. ½ move rate for {{5d10}} rounds"          ],
    [ 61,  63, -1, "Twist ankle, fall/{{F51}}/{{F56}}"                     ],
    [ 64,  67, -1, "Vision impaired/"           +
                   "-25% to attacks & parries/" +
                   "{{1d3}} rounds unengaged to clear"                     ],
    [ 68,  70, -1, "Vision impaired/"           +
                   "-50% to attacks & parries/" +
                   "{{1d6}} rounds unengaged to clear"                     ],
    [ 71,  72, -1, "Blinded. No attacks or parries/"   +
                   "{{1d6}} rounds unengaged to clear"                     ],
    [ 73,  74, -1, "Distracted. +25% bonus to attacking foes"              ],
    [ 75,  78, -1, "Drop {{item}}: {{1d3}} rounds to recover"              ],
    [ 79,  82, -1, "{{item}} knocked {{1d6}} meters to the {{compass}}"    ],
    [ 83,  86, -1,
      "{{item}} shattered (100% chance)/"          +
      "-10% for each point of battle magic on it/" +
      "-20% for each point of rune magic on it"                            ],
    [ 87,  89, -1,
      "Hit nearest friend (or self) for {{damage}} in {{hit.melee}}",
      "Foe hits automatically unless they also fumbled"                    ],
    [ 90,  91, -1,
      "Hit nearest friend (or self) for {{DAMAGE}} in {{hit.melee}}",
      "Foe hits automatically unless they also fumbled"                    ],
    [ 92,  92, -1,
      "Hit nearest friend (or self) for {{CRITICAL!}} in {{hit.melee}}",
      "Foe hits automatically unless they also fumbled"                    ],
    [ 93,  95, -1,
      "Hit self for {{damage}} in the {{hit.melee}}",
      "Foe hits automatically for MAX damage unless they also fumbled"     ],
    [ 96,  97, -1,
      "Hit self for {{DAMAGE}} in {{hit.melee}}",
      "Foe hits automatically for CRITICAL damage unless they also fumbled"],
    [ 98,  98, -1,
      "Hit self for {{CRITICAL!}} in {{hit.melee}}",
      "Foe hits automatically for CRITICAL damage unless they also fumbled"],
    [ 99,  99, +1, "Son of a…"                                             ],
    [100, 100, +2, "Mother of Dog…"                                        ],
];

const pinfo_pat = "//*[starts-with(@id, 'personal-info.')]";

// =========================================================================
// storage abstraction
var _storage_prefix = undefined;
function spfx ()
{
    if( _storage_prefix != undefined )
        return _storage_prefix;

    var match;
    if( match = /\??([^&;:]+)/.exec( location.search ) )
        _storage_prefix = match[ 1 ] + ':'
    else
        _storage_prefix = '';

    return _storage_prefix;
}

function storage_get (k)
{
    return localStorage.getItem( spfx() + k );
}

function storage_set (k,v)
{
    return localStorage.setItem( spfx() + k, v );
}

function storage_zap (k)
{
    return localStorage.removeItem( spfx() + k )
}

function storage_keys ()
{
    var pfx = spfx();
    var len = pfx.length;
    return len ?
        ( Object.keys( localStorage )
          .filter( k => k.startsWith( pfx ) ).map( s => s.substring( len ) ) ) :
        ( Object.keys( localStorage )
          .filter( k => !k.match( /^.*:\S+?\.\S+/ ) ) );
}

const storage = { get:  storage_get ,
                  set:  storage_set ,
                  keys: storage_keys,
                  del:  storage_zap };

function skill_is_standard (id)
{
    return standard_skills[ id ] ? id : false;
}
// =========================================================================
// utilities

const ucfre = /\b([a-z])/g;
function ucfirst (s)
{
    return s.replace( ucfre, function (m,c,o,s) { return c.toUpperCase(); } );
}

function xmatch_token(attr, tok)
{
    return "contains(concat(' ', @" + attr + ", ' '), ' " + tok + " ')";
}

function xmatch_class(tok)
{
    return xmatch_token( 'class', tok );
}

function xpath (path, context, type)
{
    var rtype  = XPathResult[ type || 'ORDERED_NODE_SNAPSHOT_TYPE' ];
    var ctx    = context || document;
    var result = document.evaluate( path , ctx, null, rtype, null );
    return result;
}

function element (x)
{
    var el = document.createElement( x );

    for( var i = 1; i < arguments.length; i+= 2 )
        el.setAttribute( arguments[ i ], arguments[ i+1 ] );

    return el;
}

function div ()
{
    if( arguments.length )
    {
        var arg = Array.prototype.slice.call( arguments );
        arg.unshift( 'div' );
        return element.apply( this, arg );
    }

    return element( 'div' );
}

function get_dom_node (id)
{
    return document.getElementById( id );
}

function get_colour_value (text)
{
    var canary = get_dom_node( 'colour' );
    var style  = getComputedStyle( canary );

    canary.style.color = text;

    return style.color;
}

function set_dom_node_text (id, text, edit)
{
    var node = get_dom_node( id );

    if( !node )
        return undefined;

    node.textContent = '' + text;

    if( edit )
        handle_edit_event.apply( node );

    return node;
}

function set_select_element_by_value (select, val)
{
    if( !select ) return;
    if( select.nodeName != 'SELECT' ) return;

    for( var i = 0; i < select.childNodes.length; i++ )
    {
        if( select.childNodes[i].nodeName != 'OPTION' ) continue;
        if( select.childNodes[i].value     !=  val     ) continue;

        select.childNodes[i].selected = true;
        break;
    }
}

function utoa (str)
{
    return btoa( unescape( encodeURIComponent( str ) ) );
}

function atou (str)
{
    return decodeURIComponent( escape( atob( str ) ) );
}

// like the text content prop except <br> gets tutned into \n
function node_content (n)
{
    var text = '';

    if( !n || !n.nodeName )
        return "";

    if( n.nodeName == 'BR' )
        return "\n";

    for( const child of n.childNodes )
        switch( child.nodeType )
        {
            case Node.ELEMENT_NODE: text += node_content( child ); break;
            case Node.TEXT_NODE:    text += child.textContent;    break;
        }

    return text;
}

// =========================================================================
// CSS utilities
function get_css_rule (selector, sheet)
{
    var ss = sheet ? [ sheet ] : document.styleSheets;

    for( const s of ss )
        for( const r of s.cssRules )
            if( r.selectorText == selector )
                return { sheet: s, rule: r };

    return null;
}

function user_defined_rule_for (selector)
{
    const usr_selector = '#usr-def, ' + selector;
    // find the stylesheet with the rule we're overriding:
    const orig_css = get_css_rule( selector );

    if( !orig_css )
        return null;

    var new_css = get_css_rule( usr_selector, orig_css.sheet );

    if( new_css )
        return new_css.rule;

    // generate a new rule:
    var rtxt = usr_selector + " { }";
    var css  = orig_css.sheet;
    var ridx = css.cssRules.length;

    try { ridx = css.insertRule( rtxt, ridx ); }
    catch( error )
    {
        var msg = 'user_defined_rule_for( '+ selector +' ): ' + error.message;
        console.log( msg );
        ridx = -1;
    }

    return ( ridx >= 0 ) ? orig_css.sheet.cssRules[ ridx ] : null;
}

// =========================================================================
// colour control
function rgba_values (text)
{
    var m;
    var spec;

    if( m = /\brgba?\((.*?)\)/.exec( text ) )
        if( spec = m[ 1 ] )
            spec = spec.split( /\s*,\s*/ );

    return spec;
}

var active_colour;
const rgb_rnode_ids = [ 'rr', 'rg', 'rb' ];

function get_usr_rgb_pane (key)
{
    var path = "//div[@class='rgb-usr'][@data-ckey='" + key + "']";
    var pane = xpath( path );

    if( pane && pane.snapshotLength == 1 )
        return pane.snapshotItem( 0 );

    return null;
}

function reset_page_colours (from)
{
    var remapped = colour_scheme[ from ];

    if( !remapped )
        return;

    for( const rule of remapped )
    {
        if( !rule )
            continue;

        var selector = rule[ 2 ];
        var css_attr = rule[ 3 ];

        var usr_rule = user_defined_rule_for( selector );

        if( !usr_rule )
            continue;

        delete colour_remap[ from ];
        usr_rule.style.removeProperty( css_attr );
    }
}

function adjust_page_colours (from, to)
{
    var remapped = colour_scheme[ from ];

    if( !remapped )
        return;

    for( const rule of remapped )
    {
        if( !rule )
            continue;

        var selector = rule[ 2 ];
        var css_attr = rule[ 3 ];

        var usr_rule = user_defined_rule_for( selector );

        if( !usr_rule )
            continue;

        colour_remap[ from ] = to;
        usr_rule.style[ css_attr ] = to;
    }
}

function slide_colour (e)
{
    if( !active_colour )
        return;

    var rgb  = [];
    var pane = get_usr_rgb_pane( active_colour );

    if( !pane )
    {
        console.log( 'no pane for ' +  active_colour );
        return;
    }
    for( var x = 0; x < rgb_rnode_ids.length; x++ )
        if( range = get_dom_node( rgb_rnode_ids[ x ] ) )
            rgb[ x ] = range.value * 1;

    var colour = ( 'rgb(' +
                   rgb[ 0 ] + ', ' +
                   rgb[ 1 ] + ', ' +
                   rgb[ 2 ] + ')'  );

    pane.style[ 'background-color' ] = colour;
    adjust_page_colours( active_colour, colour );
}

function set_active_colour (e, reset)
{
    var key  = this.getAttribute( 'data-ckey' );
    var pane = get_usr_rgb_pane( key );
    var map;
    var rgba;
    var range;

    if( pane )
    {
        if( reset )
            pane.style[ 'background-color' ] = key;
        else if( map = pane.style['background-color'] )
            map = get_colour_value( map );
    }

    if( rgba = rgba_values( map || key ) )
        for( var x = 0; x < rgb_rnode_ids.length; x++ )
            if( range = get_dom_node( rgb_rnode_ids[ x ] ) )
                range.value = rgba[ x ];

    active_colour = key;

    if( reset )
        reset_page_colours( key );

    if( this.nodeName != 'INPUT' )
    {
        var path  = "preceding-sibling::div[@class='rgb-rad'][1]/input";
        var radio = xpath( path, this );

        if( radio && radio.snapshotLength > 0 )
            if( radio = radio.snapshotItem( 0 ) )
                radio.checked = true;
    }
}

function reset_active_colour (e)
{
    return set_active_colour.apply( this, [ e, true ] );
}

function reset_palette (e)
{
    var pane;

    for( const key in colour_scheme )
    {
        if( pane = get_usr_rgb_pane( key ) )
            pane.style[ 'background-color' ] = key;

        reset_page_colours( key );
    }
}

function save_palette (e)
{
    var str = JSON.stringify( colour_remap );
    localStorage.setItem( 'colour-map', str );

    var msg;
    if( msg = get_dom_node( 'result' ) )
        clear_element( msg, '🎨 Colour palette saved' );
}

function load_palette (e)
{
    var str = localStorage.getItem( 'colour-map' );
    var map = JSON.parse( str );

    for( const colour in map )
        adjust_page_colours( colour, map[ colour ] );
}

function toggle_palette (e)
{
    var palette = get_dom_node( 'palette' );
    if( !palette )
        return;

    if( palette.style.visibility == 'visible' )
        return palette.style.visibility = 'collapse';
    else
        palette.style.visibility = 'visible';

    var wpath   = "//input[@id='rb']/parent::div/following-sibling::div[@data-ckey]";
    var widgets = xpath( wpath );
    var cell;

    if( widgets )
        for( var w = 0; w < widgets.snapshotLength; w++ )
            if( cell = widgets.snapshotItem( w ) )
                cell.parentElement.removeChild( cell );

    for( const key in colour_scheme )
    {
        var map   = colour_remap[ key ] || key;
        var divr  = div( 'data-ckey', key, 'class', 'rgb-rad' );
        var divd  = div( 'data-ckey', key, 'class', 'rgb-def' );
        var divu  = div( 'data-ckey', key, 'class', 'rgb-usr' );
        var radio = element( 'input',
                             'type'     , 'radio' ,
                             'name'     , 'colour',
                             'data-ckey', key     ,
                             'value'    , key     );

        radio.addEventListener( 'click', set_active_colour   );
        divd.addEventListener ( 'click', reset_active_colour );
        divu.addEventListener ( 'click', set_active_colour   );

        divr.appendChild( radio );
        divd.textContent = ' ';
        divu.textContent = ' ';
        divd.style[ 'background-color' ] = key;
        divu.style[ 'background-color' ] = map;

        palette.appendChild( divr );
        palette.appendChild( divd );
        palette.appendChild( divu );
    }
}

// =========================================================================
// export character
const GCSTART = "-----BEGIN GLORANTHA CHARACTER-----\n";
const GCEND   = "-----END GLORANTHA CHARACTER-----\n";

function close_io_pane (e)
{
    var iopane = get_dom_node( 'import-export' )

    if( iopane )
        iopane.parentElement.removeChild( iopane );
}

function io_pane ()
{
    var panel  = div( 'id', 'import-export', 'class', 'import-export' );
    var iopane = element( 'pre', 'id', 'io-data', 'class', 'io-data' );
    var cancel = div( 'class', 'io-cancel cancel' );

    if( !panel )
        return;

    cancel.textContent = 'Close';

    panel.appendChild( iopane );
    panel.appendChild( cancel );

    cancel.addEventListener( 'click', close_io_pane );

    document.body.appendChild( panel );

    return iopane;
}

function export_data ()
{
    var data   = {};
    var iopane = io_pane();
    var blob;
    var formatted;

    for( const g of groups )
    {
        var gcache = [];

        for( const i of g.items )
            if( !i.noedit )
                if( skill_is_standard( g.group + '.' + i.key ) )
                    gcache.push( (i.base == null) ? [ i.key, i.val ] : [ i.key, i.val, i.base ] );
                else
                    gcache.push( [ false, i ] );

        data[ g.group ] = gcache;
    }

    var pinfo = xpath( pinfo_pat );
    var node;
    var id;
    var v;

    for( var n = 0; pinfo && (n < pinfo.snapshotLength); n++ )
        if( node = pinfo.snapshotItem( n ) )
            if( id = node.getAttribute( 'id' ) )
                if( (v = storage.get( id )) )
                    data[ id ] = v;

    blob = JSON.stringify( data );
    blob = utoa( blob );

    formatted = GCSTART;
    for( var c = 0; c < blob.length; c += 160 )
        formatted += blob.substr( c, 160 ) + "\n";
    formatted += GCEND;

    iopane.textContent = formatted;
}

function import_item( grp, data )
{
    var group;

    if( !(group = get_group( grp )) )
        return '';
    var bonus = group_modifier( group );

    var id;             // groupid.itemid
    var rid;      // returned id (≠ id for paired runes)
    var cur_item;
    var new_item = {};
    var itemid;

    if( itemid = data[ 0 ] ) // exported item was predefined
    {
        id           = grp + '.' + itemid;
        new_item.val = data[ 1 ];
        if( data[ 2 ] != undefined )
            new_item.base = data[ 2 ];
    }
    else // exported item was user-defined
    {
        new_item = data[ 1 ];
        id       = grp + '.' + new_item.key;
    }

    rid = id;

    // item is defined in the importing character
    if( cur_item = get_entry( id ) )
    {
        if( cur_item.noedit ) // oops item is read-only in our definition
            return rid;

        // predefined skill in importer:
        // import at most base value and level
        if( skill_is_standard( id ) )
        {
            if( new_item.base != undefined )
                cur_item.base = new_item.base;
        }
        else // user defined skill: import everything we have:
        {
            for( const x of Object.keys( new_item ) )
                cur_item[ x ] = new_item[ x ];

            for( const x of Object.keys( cur_item ) )
                if( new_item[ x ] == undefined )
                    delete cur_item[ x ];
        }

        var val  = new_item.val;
        var base = entry_base( cur_item );

        switch( cur_item.type )
        {
          case 'prune':
            id = 'prune.' + cur_item.subkeys[ 0 ];
            break;

          case 'weapon':
          case 'stat':
            if( (base + val) > 0 )
                if( !isNaN( bonus ) )
                    val += bonus + base;
            break;
        }

        // flush to UI and storage:
        if( val != undefined )
            set_dom_node_text( id, val, true );
        else
            set_dom_node_text( id, '', true );

        return rid;
    }
    // item not yet defined in importer but was user defined in exporter
    else if( new_item.key )
    {
        group.items.push( new_item );
        draw_new_skill( group, new_item );
        return rid;
    }
    else // oops. predefined item in exporter that no longer exists
    {
        return '';
    }
}

function synthetic_click_delete (id)
{
    var button;
    var delpath =
        "//*[@class='delete-item'][@data-ge-id='" + id + "']";
    var ui = xpath( delpath );

    if( ui && ui.snapshotLength == 1 )
        if( button = ui.snapshotItem( 0 ) )
            delete_user_item.apply( button, null );
}

function is_in  (k,g) { return  k.startsWith( g + '.' ); }
function not_in (k,g) { return !k.startsWith( g + '.' ); }

function import_blob ()
{
    var iodata = get_dom_node( 'io-data' );

    if( !iodata )
        return;

    var raw   = node_content( iodata );
    var chunk;

    if( raw = raw.split( GCSTART )[ 1 ] )
        if( raw = raw.split( GCEND ) )
            if( raw.length >= 2 )
                chunk = raw[ 0 ];

    if( !chunk )
        return;

    var lines = chunk.split( "\n" );
    lines.pop();

    var blob = '';
    var m;
    for( const l of lines )
        if( m = (/^\s*(\S+)\s*$/m).exec( l ) )
            blob += m[ 1 ];

    var jstxt = atou( blob );
    var data  = JSON.parse( jstxt );
    var seen  = {};

    // first personal info - no side effects
    for( const key of Object.keys( data ).filter( k => is_in( k, 'personal-info' ) ) )
        set_dom_node_text( key, data[ key ], true );

    // next the stats so we set our group bonuses
    for( const key of Object.keys( data ).filter( k => is_in( k, 'stats' ) ) )
        for( const ig of data[ key ] )
            seen[ import_item( key, ig ) ] = true;

    // and the rest:
    for( const key of Object.keys( data ).filter( k => not_in( k, 'stats' ) ) )
        for( const ig of data[ key ] )
            seen[ import_item( key, ig ) ] = true;

    // delete any user-defined skills we currently have but
    // which were not in the import:
    var id;
    for( const g of groups )
        for( const i of g.items )
            if( id = g.group + '.' + i.key )
                if( !seen[ id ] )
                    synthetic_click_delete( id );

    close_io_pane();
}

function import_data ()
{
    var iopane = io_pane();
    var load   = div( 'class', 'io-load exec' );

    load.textContent = 'Load';
    load.addEventListener( 'click', import_blob );

    iopane.textContent = "Paste Data here:\n-----\n\n-----\n";
    iopane.contentEditable = 'true';

    iopane.parentElement.appendChild( load );
}

function toggle_io_ui ()
{
    var ui;

    for( const id of ['save-button','load-button'] )
        if( ui = get_dom_node( id ) )
            ui.style.visibility =
              (ui.style.visibility == 'visible') ? 'hidden' : 'visible';
}

// =========================================================================
// input handling

function eventstr (e)
{
    var estring = '{ ';

    for( var prop in e )
        if( prop == 'target' || prop == 'type' )
            estring += prop + ': ' + e[prop] + ', ';

    estring += 'which' + ': ' + e.which    + ' ';
    estring += '} ';

    return estring;
}

function event_to_char(e)
{
    if( !e )
        return 0;

    // for a key associated with a single glyph, return the character code
    // othwerwise use the raw event.which value which maps to the key rather
    // than a character (eg you'd get D instead of d, but it's what we want
    // for DEL, BS, etc):
    return ( e.key && e.key.length == 1 ) ? e.key.charCodeAt( 0 ) : e.which;
}

function suppress_input (e)
{
    var ec = editclass( e.target );

    if( !ec )
        return;

    var key = event_to_char( e );

    //console.log( ec + ':' + key );
    //console.log( eventstr(e) );

    if( allowed_keys[ec] )
        if( !allowed_keys[ec][key] )
            e.preventDefault();

    if( suppressed_keys[ec] )
        if( suppressed_keys[ec][key] )
            e.preventDefault();
}

function handle_edit_event (e)
{
    var uc  = updateclass( this );
    var id  = this.getAttribute( 'id' );
    var cat = split_id( id )[ 0 ];
    if( cat == 'personal-info' )
        uc = 'pinfo';

    if( !uc )
        return;

    var name;
    var val = this.textContent;

    if ( !id || ( id == "") )
        return;

    switch( uc )
    {
      case 'prune':
          name = split_id( id )[ 1 ];
          update_prune( name, val * 1 );
          break;

      case 'pinfo':
          storage.set( id, val );
          break;

      case 'skill':
      case 'attr':
      case 'runespell':
          update_item( id, val );
          break;

      case 'rp':
          update_rp( id, val );
          break;

      case 'manual-buff':
          manual_buff_val = val * 1;
          break;

      case 'misc':
          update_misc( id );
          break;

      default:
          console.log( 'No edit handler for ' + uc );
          return;
    }
}

function toggle_manual_buffs (e)
{
    var mbuf_ui = get_dom_node( 'manual-buff-list' );

    if( manual_buff_on )
    {
        manual_buff_on = false;
        mbuf_ui.style.visibility = 'collapse';
    }
    else
    {
        manual_buff_on = true;
        mbuf_ui.style.visibility = 'visible';
    }
}

function set_inspired_skill (id, panel)
{
    var label;
    var skill = get_entry( id );

    if( !skill )
        return false;

    if( skill.type != 'stat' && skill.type != 'weapon' )
        return false;

    auto_buff_on = id;
    label = item_label( skill );

    var inspired = get_dom_node( 'inspired' );
    if( inspired )
    {
        inspired.textContent =
            label + ((auto_buff_val >= 0) ? ' +' : ' ') + auto_buff_val;
        inspired.style.visibility = 'visible';
    }

    var expired = get_dom_node( 'expiration' );
    if( expired )
    {
        expired.style.visibility = 'visible';
    }

    clear_element( panel );

    return true;
}

function unset_inspired_skill (e)
{
    auto_buff_on = false;

    var inspired = get_dom_node( 'inspired' );
    if( inspired )
    {
        inspired.textContent = '-';
        inspired.style.visibility = 'collapse';
    }

    var expired = get_dom_node( 'expiration' );
    if( expired )
        expired.style.visibility = 'collapse';

    return true;
}

function tick_skill (id, panel)
{
    var ticks = get_group( 'ticks' );
    var label;
    var m;

    if( tick_pending )
        tick_pending = false;
    else
        return;

    if( !ticks )
        return clear_element( panel, 'Ticks data missing - character sheet error' );

    if( m = /^prune\.(.+)$/.exec( id ) )
    {
        var rune = m[1];
        label = ucfirst( rune );
    }
    else
    {
        var skill = get_entry( id );
        if( !skill )
            return clear_element( panel, 'Skill ' + id + ' not found' );

        label = item_label( skill );

        if( split_id( id )[0] == 'lore' )
            label = 'Lore: ' + label;
    }

    for( const t of ticks.items )
        if( t.key == id )
            return ( panel ?
                     clear_element( panel, label + ' already ticked' ) :
                     false );

    var new_tick = { key: id, type: 'tick', label: label, val: 1 };
    ticks.items.push( new_tick );
    draw_new_tick( new_tick );
    clear_element( panel, '🎲 ' + label + ' ticked' );
}

function buff_value_for (id)
{
    var skill;
    var one_shot = 0;

    if( !id )
        return 0;

    skill = get_entry( id );

    //console.log( "checking buff for " + id + ' : ' + skill.type );

    if( id != 'misc.misc' )
    {
        if( !skill )
            return 0;

        if( skill.type != 'stat' && skill.type != 'weapon' )
            return 0;
    }

    // consume any available one-shot bonus/malus
    if( one_shot_buff_val )
    {
        one_shot += one_shot_buff_val * 1;
        one_shot_buff_val = 0;
    }

    // we can have only one of manual or auto buff, but
    // the one-shot always applies as that's how we
    // do chained skills like hide + move-quietly = stealth
    if( manual_buff_on )
        return one_shot + manual_buff_val * 1;

    if( auto_buff_on )
        if( auto_buff_on == id )
            return one_shot + auto_buff_val * 1;

    return one_shot;
}

function roll_label (dice)
{
    var id;
    var skill;
    var group;
    var prefix = '🎲';

    if( !dice )
        return "🎲 Roll:";

    if( dice.textContent )
        prefix = dice.textContent;

    prefix = prefix.replace( /^\s+|\s+$/g, '' );

    if( id = dice.getAttribute('data-ge-id') )
        if( skill = get_entry( id ) )
            group = get_group( id );

    if( group && group.group == 'lore' )
        return prefix + "Lore (" + item_label( skill ) + "):";

    if( skill )
        return prefix + item_label( skill ) + ":";

    return prefix +
        dice.parentNode.previousElementSibling.textContent + ':'
}

function get_target (node)
{
    var id;

    if( !node )
        return undefined;

    if( !(id = node.getAttribute( 'data-ge-id' )) )
        return undefined;

    return get_dom_node( id );
}

function do_something (e)
{
    var target = get_target( this );
    var rtype  = editclass( target );
    var atype  = updateclass( target );
    var rnode  = document.getElementById( 'result' );
    var id     = target.getAttribute( 'id' );
    var action = this.getAttribute( 'data-action' ) || 'roll';

    if( atype == 'prune' )
    {
        // next consume and apply the tick-pending flag:
        if( tick_pending )
            return tick_skill( id, rnode );

        return roll_prune( rnode, this, target );
    }

    if( atype == 'hit' )
        return roll_hit_location( rnode, this );

    if( rtype == 'dice' )
        return roll_ndxseq( rnode, target.textContent );

    // special case: POW can be ticked
    if( tick_pending && (id == 'stats.pow') )
        return tick_skill( id, rnode );

    if( (atype == 'attr') && (rtype == 'uint') )
        return setup_nx_roll( rnode, this, target.textContent );

    if( (atype == 'runespell') && (rtype == 'uint') )
        return cast_runespell( rnode, this.getAttribute( 'data-rune' ), id );

    if( atype == 'skill' && rtype == 'uint' )
    {
        // resolve auto-buff (inspiration) first
        if( auto_buff_on == 'unselected' )
            if( set_inspired_skill( id, rnode ) )
                return;

        // next consume and apply the tick-pending flag:
        if( !/^personal-info\./.exec( id ) )
            if( tick_pending )
                return tick_skill( id, rnode );

        var skill          = target.textContent * 1;
        var buff           = buff_value_for( id );
        var adjusted_skill = skill + buff;

        // weapons in the same category can be used at ½ the
        // highest skill in that category:
        var data  = get_entry( id );
        if( data && data.type == 'weapon' )
        {
            var buf2  = buff_value_for( id ); // this will be sans 1-shot buffs
            var group = get_group( id );
            var gmod  = group_modifier( group );
            var cat   = data.cat;
            var hands = data.hands;

            for( const i of group.items )
            {
                if( i.key == data.key )
                    continue;
                if( i.cat   != data.cat  ||
                    i.hands != data.hands )
                    continue;

                // we need to figure out if the alt skill,
                // including skill-specific buffs and one
                // shot buffs, is > 2× the weapon we are trying:
                var one_shot  = buff - buf2;
                var alt_id    = group.group + '.' + i.key;
                var alt_buff  = buff_value_for( alt_id ) + one_shot;
                var alt_skill = (gmod + i.base + i.val + alt_buff) / 2;
                if( alt_skill < adjusted_skill )
                    continue;

                adjusted_skill = alt_skill;
                break;
            }
        }

        var rl = roll_label( this );

        switch( action )
        {
          case 'attack':
              return roll_attack( rnode, skill, adjusted_skill, rl, data );
          case 'parry':
              return roll_parry ( rnode, skill, adjusted_skill, rl, data );
          default:
              return roll_d100  ( rnode, skill, adjusted_skill, rl );
        }
    }

    rnode.textContent = 'What?';
}

// =========================================================================
// accessors

function editclass (node)
{
    var nc = ' ' + node.getAttribute('class') + ' ';
    for( const c of ["text", "uint", "int", "blob", "dice", "base", "uflt"] )
        if( nc.indexOf( ' ' + c + ' ') >= 0 )
            return c;

    return false;
}

function updateclass (node)
{
    var nc = ' ' + node.getAttribute('class') + ' ';
    for( const c of ['pinfo', 'skill', 'attr', 'prune', 'hit', 'rp', 'weapon', 'manual-buff', 'runespell', 'misc'] )
        if( nc.indexOf( ' ' + c + ' ') >= 0 )
            return c;

    return false;
}

function get_group (grp)
{
    var id = grp.split('.');
    grp = id[0];

    for( const g of groups )
        if( g.group == grp )
            return g;

    return null;
}

function split_id (i)
{
    var id   = i.split( '.' );
    var grp  = id.shift();
    var name = id.join('.');
    return [ grp, name ];
}

const basere = /^(\S+?\.\S+?)(?:\*(\d+))?$/;
function entry_base (entry)
{
    var matched;

    if( !entry )
        return undefined;

    if( !entry.base )
        return 0;

    if( !isNaN( entry.base ) )
        return entry.base;

    if( matched = entry.base.match( basere ) )
    {
        var stat   = matched[ 1 ];
        var factor = matched[ 2 ] ? (matched[ 2 ] * 1) : 1;
        var attr   = get_entry( stat );

        if( attr )
            return 1 * attr.val * factor;
    }

    return undefined;
}

function del_entry (ident)
{
    var id    = split_id( ident );
    var group = id[ 0 ];
    var name  = id[ 1 ];
    var grp   = get_group( group );
    var gone  = null;

    if( !grp )
        return null;

    for( var i = 0; !gone && (i < grp.items.length); i++ )
        if( grp.items[ i ].key == name )
            gone = grp.items.splice( i, 1 );

    return gone;
}


function get_entry (ident)
{
    var id    = split_id( ident );
    var group = id[ 0 ];
    var name  = id[ 1 ];
    var grp   = get_group( group );

    if( !grp )
        return null;

    var item;
    for( const i of grp.items )
    {
        if( i.key != name )
            continue;

        item = i;
        break;
    }

    var derived;
    if( (group == 'derived') && item )
        if( derived = get_dom_node( ident ) )
            item.val = derived.textContent;

    return item;
}

function group_modifier (g)
{
    var bonus = 0;
    var stat;
    var val;
    var ancestor;

    if( !g.modifier )
        return g.bonus;

    if( g.modifier.inherit )
        if( ancestor = get_group( g.modifier.inherit ) )
            return group_modifier( ancestor );

    if( g.modifier.primary )
        for( const s of g.modifier.primary )
            if( stat = get_entry( 'stats.' + s ) )
                bonus += (maths.ceil( (stat.val * 1) / 4 ) - 3) * 5;

    if( g.modifier.disability )
        for( const s of g.modifier.disability )
            if( stat = get_entry( 'stats.' + s ) )
                bonus -= (maths.ceil( (stat.val * 1) / 4 ) - 3) * 5;

    if( g.modifier.secondary )
        for( const s of g.modifier.secondary )
            if( stat = get_entry( 'stats.' + s ) )
                if( val = stat.val * 1 )
                    bonus += ( (val <=  4) ? -5 :
                               (val <= 16) ?  0 :
                               maths.ceil( (val - 16) / 4 ) * 5 );

    if( g.modifier.penalty )
        for( const s of g.modifier.penalty )
            if( stat = get_entry( 'stats.' + s ) )
                if( val = stat.val * 1 )
                    bonus -= ( (val <=  4) ? -5 :
                               (val <= 16) ?  0 :
                               maths.ceil( (val - 16) / 4 ) * 5 );

    return bonus;
}

// =========================================================================
// cache update mechanisms
function update_rp (id,val)
{
    var m;
    var rid = id;

    if( !id )
        return;

    if( m = /^(rp\..+?)\.cur$/.exec( id ) )
        rid = m[ 1 ];

    var pool = get_entry( rid );

    if( m )
        pool.cur = val * 1;
    else
        pool.val = val * 1;

    var nv = JSON.stringify( pool );
    storage.set( rid, nv );

    return true;
}

function _update_prune (p,i,val)
{
    var update;
    var node;
    var other = 100 - val;

    i = i & 1;

    // paired runes actually only store the value of the
    // 'primary' (eg statis/motion only stores stasis)
    // so we have to set the correct value, which will be
    // be the value the user _didn't_ edit:
    if( i == 1 )
        p.val = other;
    else
        p.val = val;

    update = p.subkeys[ i ^ 1 ];
    node = document.getElementById( 'prune.' + update );

    if( node )
        node.textContent = other;

    var nv = JSON.stringify( p );
    storage.set( 'prune.' + p.key, nv );

    return true;
}

function update_prune (n,v)
{
    var tgt = null;
    var prg = get_group( 'prune' );
    var pe  = null;

    if( !prg )
        return;

    // update the paired rune entry that has 'n' as one
    // of its member runes:
    for( pe of prg.items )
        if( (tgt = pe.subkeys.indexOf( n )) >= 0 )
            return _update_prune( pe, tgt, v );

    return null;
}

function update_item (i,v,norecurse)
{
    var item = get_entry( i );

    if( item )
    {
        if( !item.noedit )
        {
            var group = get_group( i );
            if( !isNaN(v) )
            {
                if( v == 0 )
                {
                    item.val = 0;
                }
                else // nonzero skills have modifiers removed before storage:
                {
                    var bonus = group.bonus ? group.bonus : 0;
                    var base  = entry_base( item );
                    item.val  = v - (bonus + base);
                }
            }
            else
            {
                item.val = v;
            }

            var nv = JSON.stringify( item );
            if( nv )
                storage.set( i, nv );
        }

        if( norecurse )
            return;

        // update derived attributes
        var callbacks = attr_map[ i ];
        if( callbacks )
            for( const cb of callbacks )
                cb();

        // update any skill group modifiers
        var id = split_id( i );
        if( id[0] != 'stats' )
            return;

        var altered = [];
        var secondary = [];
        var attr = id[ 1 ];

        // figure out which groups modifiers were altered by this stat
        for( const g of groups )
        {
            if( !g.modifier )
                continue;
            // if this stat is mentioned in the group's modifier list
            for( const x in g.modifier )
                if( x != 'inherit' )
                    for( const m of g.modifier[ x ] )
                        if( m == attr )
                            altered[ g.group ] = 1;
        }

        // indirectly modified groups (stat → altered-group → dependent group)
        for( const g of groups )
            if( g.modifier         &&
                g.modifier.inherit &&
                altered[ g.modifier.inherit ] )
                secondary[ g.group ] = 1;

        for( const g in altered )
            refresh_group( get_group(g) );
        for( const g in secondary )
            refresh_group( get_group(g) );
    }
}

function update_misc (i)
{
    var id  = i.replace( /\.per$/, '' );
    var val = get_dom_node( id );

    if( !val )
        return;

    var tot = get_dom_node( id + '.tot' );
    var per = get_dom_node( id + '.per' );

    val = (val.textContent || 0) * 1;
    per = per ? ((per.textContent || 0) * 1) : 0;

    if( tot )
        tot.textContent = '' + ( val * per ) + 'L';

    var item = get_entry( id );

    if( item )
    {
        var nv;

        item.per = per;
        item.val = val;

        if( nv = JSON.stringify( item ) )
            storage.set( id, nv );
    }
}
// =========================================================================
// UI rendering

function _make_stat_value(dl, id, data, bonus, subtype)
{
    var dd   = element( 'dd' );
    var cssc = (data.noedit ? 'derived ' : 'editable ') + subtype + ' ';
    var val  = data.val;
    var sval = element( 'span' );
    var sbtn = element( 'span', 'data-ge-id', id );
    var base = entry_base( data );
    var parry;

    switch( data.type )
    {
        case 'weapon':
          if( !data.noroll ) // this would make no sense to set for weapons
          {
              parry = element( 'span', 'data-ge-id', id, 'class', 'roll',
                               'data-action', 'parry' );
              parry.textContent =
                  (( data.cat == 'shield.shield' ) ? '🛡' : '⚔') + '  ';
              parry.style.float = 'left';
              parry.style.width = '2em';
              sbtn.setAttribute( 'data-action', 'attack' );
          }
        case 'attr':
        case 'stat':
        case 'rune':
        case 'emotion':
          cssc += 'uint';
          val *= 1;
          break;
        case 'dice':
          cssc += 'dice';
          break;
        default:
          cssc += 'text';
    }

    // bonus is only added if either:
    // a) base is nonzero (ie skill has a nonzero default)
    // b) skill is already nonzero (learned skill)
    if( (base + val) > 0 )
        if( !isNaN( bonus ) )
            val += bonus + base;

    sval.setAttribute( 'id', id );
    sval.setAttribute( 'class', cssc );
    sval.textContent = '' + val;

    if( data.noroll )
    {
        sbtn.textContent = '   ';
    }
    else
    {
        sbtn.setAttribute( 'class', 'roll' );
        if( data.type == 'rune' && rune_glyph[ data.key ] )
            sbtn.textContent = rune_glyph[ data.key ] + '  ';
        else
            sbtn.textContent = "🎲  ";

        if( parry )
            dd.appendChild( parry );
    }

    sbtn.style.float = 'left';
    sbtn.style.width = '2em';

    dd.appendChild( sbtn );
    dd.appendChild( sval );
    dl.appendChild( dd  );
}

function make_rp (dl, id, data)
{
    var dd   = element( 'dd' );
    var val  = data.val;
    var cur  = data.cur;
    var cssc = 'editable rp uint';
    var sval = element( 'span', 'id', id, 'class', cssc );
    var scur = element( 'span', 'id', id + '.cur' ,'class', cssc );
    var sbtn = element( 'span', 'data-ge-id', id );

    sval.textContent = '' + val;
    scur.textContent = '' + cur;

    sbtn.textContent = ' ';

    sbtn.style.width = '2em';

    dd.appendChild( sbtn );
    dd.appendChild( scur );
    dd.appendChild( document.createTextNode(' / ') );
    dd.appendChild( sval );
    dl.appendChild( dd  );
}

function make_runespell (dl, id, data)
{
    var dd   = element( 'dd' );
    var val  = data.val;
    var cssc = 'editable uint runespell';
    var sval = div( 'id', id, 'class', cssc );
    var rdiv = div( 'class', 'runeset' );

    for( const r of (data.runes || []) )
    {
        var sbtn = div( 'class', 'roll', 'data-ge-id', id, 'data-rune', r );

        sbtn.textContent = rune_glyph[ r ];
        sbtn.style.width = '2em';
        rdiv.appendChild( sbtn );
    }

    sval.textContent = '' + val;
    sval.style.width = '2em';
    rdiv.style.width = '6em';

    dd.appendChild( sval );
    dd.appendChild( rdiv );
    dl.appendChild( dd   );
}

function make_misc (dl, id, data)
{
    var dd   = element( 'dd' );
    var val  = (data.val == null) ? 1 : (data.val * 1);
    var per  = data.per || 0;
    var cssc = 'editable misc invdata ';
    var sval = element( 'span', 'id', id, 'class', cssc + 'uint' );
    var sper = element( 'span', 'id', id + '.per', 'class', cssc + 'uflt' );
    var stot = element( 'span', 'id', id + '.tot', 'class', 'invdata' );
    var at   = element( 'span' );

    sval.textContent = '' + val;
    sper.textContent = '' + per;
    stot.textContent = '  ' + (val * per) + 'L';
    at.textContent   = ' @ ';

    dd.appendChild( sval );
    dd.appendChild( at   );
    dd.appendChild( sper );
    dd.appendChild( stot );

    dl.appendChild( dd  );
}

function make_stat_value (dl, id, data, bonus)
{
    _make_stat_value( dl, id, data, bonus, 'skill' );
}

function make_attr_value (dl, id, data, bonus)
{
    _make_stat_value( dl, id, data, bonus, 'attr' );
}

function make_tick (dl, id, data)
{
    var dd   = element( 'dd' );
    var sval = element( 'span' );

    sval.setAttribute( 'id', id );
    sval.textContent = '✔';
    sval.style.width = '5em';

    dd.appendChild( sval );
    dl.appendChild( dd  );
}

function make_paired_roll_button (id, rune)
{
    var btn  = div( 'class'     , 'roll',
                    'id'        , 'invoke.' + id + '.' + rune,
                    'data-ge-id', id + '.' + rune );

    if( rune_glyph[ rune ] )
        btn.textContent = rune_glyph[ rune ] + '  ';
    else
        btn.textContent = '☯  ';
    btn.style.width = '2em';
    btn.style.clear = 'none';
    btn.style.float = 'left';

    return btn;
}

function make_paired_value (dl, data)
{
    var d0   = element( 'dd'   );
    var s0v  = element( 'span' );

    var d1   = element( 'dd'   );
    var s1v  = element( 'span' );

    var cssc = 'editable uint prune';
    var v0   = data.val;
    var v1   = 100 - data.val;
    var id   = dl.getAttribute( 'id' );

    var s0b  = make_paired_roll_button( id, data.subkeys[ 0 ] );
    var s1b  = make_paired_roll_button( id, data.subkeys[ 1 ] );
    var rune;

    rune = data.subkeys[ 0 ];
    s0v.setAttribute( 'class', cssc );
    s0v.setAttribute( 'id'   , id + '.' + rune );
    s0v.textContent = '' + v0;

    rune = data.subkeys[ 1 ];
    s1v.setAttribute( 'class', cssc );
    s1v.setAttribute( 'id'   , id + '.' + rune );
    s1v.textContent = '' + v1;

    d0.appendChild( s0b );
    d0.appendChild( s0v );

    d1.appendChild( s1b );
    d1.appendChild( s1v );

    dl.appendChild( d0 );
    dl.appendChild( d1 );
}

function item_label (data)
{
    switch( data.type )
    {
      case 'emotion':
          return ucfirst( data.subtype ) + ' (' + data.target + ')';
      case 'prune':
          return ucfirst( data.subkeys[0] + '/' + data.subkeys[1] );
      case 'attr':
      case 'stat':
      case 'rune':
      case 'dice':
      case 'weapon':
      default:
          return data.label ? data.label : ucfirst( data.key );
    }
}

function add_extra_ui_element (node, spec)
{
    if( typeof( spec ) == 'string' )
    {
        var el = element( 'span' );
        el.textContent = spec;
        node.appendChild( el );
        return;
    }

    var elt = element( spec[ 0 ] );
    for( var i = 1; i < spec.length; i++ )
    {
        var attr;
        if( attr = spec[ i++ ] )
            elt.setAttribute( attr, spec[ i ] );
        else
            elt.textContent = spec[ i ];
    }

    node.appendChild( elt );
    return;
}

function add_extra_ui_items (dl, group, width)
{
    var spec = extra_ui[ group ];

    if( !spec )
        return false;

    var dt = element( 'dt' );
    var dd = element( 'dd' );

    dt.style.width = width;

    for( const i of (spec.label || []) )
        add_extra_ui_element( dt, i );

    for( const i of (spec.content || []) )
        add_extra_ui_element( dd, i );

    dl.appendChild( dt );
    dl.appendChild( dd );

    return dt;
}

function make_item (dl, group, data, width, bonus)
{
    var dt = element( 'dt' );
    var label = item_label( data );
    var edit;
    var lspan = element( 'span' );
    var id = group + '.' + data.key;

    if( !skill_is_standard( id ) )
    {
        edit = div( 'class', 'delete-item', 'data-ge-id', id );
        edit.textContent = '⊖';
        edit.addEventListener( 'click', delete_user_item );
    }
    else
    {
        edit = div( 'class', 'noop-item', 'data-ge-id', id );
        edit.textContent = ' ';
    }
    edit.style.width = '1em';

    dt.appendChild( edit  );
    dt.appendChild( lspan );
    dt.style.width  = width;
    lspan.textContent = label;
    dl.appendChild( dt );

    bonus = bonus * 1;

    switch( data.type )
    {
      case 'attr':
          make_attr_value( dl, id, data, bonus );
          break;
      case 'emotion':
          make_stat_value( dl, id, data, bonus );
          break;
      case 'prune':
          make_paired_value( dl, data );
          break;
      case 'tick':
          make_tick( dl, id, data );
          break;
      case 'rp':
          make_rp( dl, id, data );
          break;
      case 'misc':
          make_misc( dl, id, data );
          break;
      case 'runespell':
          make_runespell( dl, id, data );
          break;
      case 'stat':
      case 'rune':
      case 'dice':
      case 'weapon':
      default:
          make_stat_value( dl, id, data, bonus );
          break;
    }

    return dt;
}

function group_label_col_width (g)
{
    var width = 3;
    var w;

    for( const i of g.items )
        if( w = item_label( i ).length )
            if( w > width )
                width = w;
    return (maths.round( width / 1.4 ) + 1) + "em";
}

function add_stat_groups ()
{
    var new_groups = [];

    for( const g of groups )
    {
        if( !g.draw ) // this group is pre-rendered in the html
        {
            var cid = g.group + '-container';
            var grp = document.getElementById( cid );
            if( !grp )
                continue;

            for( const si of g.items )
            {
                var sid = g.group + '.' + si.key;
                var sel = document.getElementById( sid );
                if( sel )
                    sel.textContent = si.val;
            }

            // remove the prerendered item from wherever it was
            // on the page. It will be added back in the order
            // of the entries in groups:
            new_groups.push( grp );
            grp.parentNode.removeChild( grp );
            continue;
        }

        var grp = div( 'id', g.group + '-container', 'class', 'group' );

        if( g.modifier )
            g.bonus = group_modifier( g );

        var title = element( 'h3', 'id', g.group + '-title' );
        title.textContent = group_title( g );

        var template = null;
        if( template = extn_template[ g.extend ] )
        {
            if( template.draw && template.save )
            {
                var handler =
                    function (e) { extn_template[ g.extend ].draw( g.group, g.extend ) };
                var nid = g.group + '.new-item';
                var add = div( 'id', nid, 'class', 'new-item' );
                add.addEventListener( 'click', handler );
                add.textContent = '➕';
                grp.appendChild( add );
            }
        }

        var lst = element( 'dl', 'id', g.group );
        var width = group_label_col_width( g );

        add_extra_ui_items( lst, g.group, width );

        for( const i of g.items )
            make_item( lst, g.group, i, width, g.bonus ? g.bonus : 0 );

        new_groups.push( grp );
        grp.appendChild( title );
        grp.appendChild( lst );
    }

    var banner = document.getElementById( 'groups' );

    for( const i of new_groups )
        banner.appendChild( i );
}

function group_title(g)
{
    var ttext = g.label;

    if( g.bonus != undefined )
        ttext += ' (' + ((g.bonus >= 0) ? '+' : '') + (g.bonus * 1) + ')';

    return '  ' + ttext;
}

function refresh_group (g)
{
    if( !g || !g.modifier )
        return;

    var new_bonus = group_modifier( g );

    if( g.bonus == new_bonus )
        return

    g.bonus = new_bonus;

    var title = document.getElementById( g.group + '-title' );
    if( title )
        title.textContent = group_title( g );

    var inode;
    for( const i of g.items )
        if( inode = document.getElementById( g.group + '.' + i.key ) )
            inode.textContent =
              '' + (g.bonus + ((entry_base(i) || 0) * 1) + (i.val * 1));
}

// add a skill to the group (or refresh if it's already there)
function draw_new_skill (group, skill)
{
    if( !group || !group.group )
        return;

    var lst   = document.getElementById( group.group );

    if( !lst )
        return;

    var gid   = lst.getAttribute( 'id' );
    var sid   = gid + '.' + skill.key;
    var width = group_label_col_width( group );
    var sval  = document.getElementById( sid );
    var score = ( ((group.bonus ? group.bonus : 0) * 1) +
                  ((skill.base  ? skill.base  : 0) * 1) +
                  (skill.val   * 1) );

    if( sval )
    {
        sval.textContent = '' + score;
    }
    else
    {
        var iel = make_item( lst, gid, skill, width,
                             group.bonus ? group.bonus : 0 );
        activate_dice( iel, "after" );
        activate_input_fields( iel, "after" );
    }

    var row = xpath( 'dt', lst );

    if( row )
        for( var i = 0; i < row.snapshotLength; i++ )
            row.snapshotItem( i ).style.width = width;

    update_item( sid, '' + score );
}

// add a rune spell to the group (or refresh if it's already there)
function draw_new_runespell (group, skill)
{
    if( !group || !group.group )
        return;

    var lst   = document.getElementById( group.group );

    if( !lst )
        return;

    var gid   = lst.getAttribute( 'id' );
    var sid   = gid + '.' + skill.key;
    var width = group_label_col_width( group );
    var sval  = document.getElementById( sid );

    if( !sval )
    {
        var iel = make_item( lst, gid, skill, width, 0 );
        console.log( iel );
        activate_dice( iel, "after" );
    }

    var row = xpath( 'dt', lst );

    if( row )
        for( var i = 0; i < row.snapshotLength; i++ )
            row.snapshotItem( i ).style.width = width;

    update_item( sid, skill.val );
}

function draw_new_tick (skill)
{
    var ticks = get_group( 'ticks' );
    var lst   = get_dom_node( 'ticks' );

    if( !lst )
        return;

    var sid   = 'ticks.' + skill.key;
    var width = group_label_col_width( ticks );
    var sval  = get_dom_node( sid );

    if( !sval )
        make_item( lst, 'ticks', skill, width, 0 );

    var row = xpath( 'dt', lst );

    if( row )
        for( var i = 0; i < row.snapshotLength; i++ )
            row.snapshotItem( i ).style.width = width;

    update_item( sid, skill.val );
}

// add a rune-pool to the group (or refresh if it's already there)
function draw_new_rp (group, skill)
{
    if( !group || !group.group )
        return;

    var lst   = document.getElementById( group.group );

    if( !lst )
        return;

    var gid   = lst.getAttribute( 'id' );
    var sid   = gid + '.' + skill.key;
    var width = group_label_col_width( group );
    var sval  = document.getElementById( sid );

    if( sval )
    {
        sval.textContent = '' + skill.val;
    }
    else
    {
        var iel = make_item( lst, gid, skill, width, 0 );
        activate_input_fields( iel, "after" );
    }

    var row = xpath( 'dt', lst );

    if( row )
        for( var i = 0; i < row.snapshotLength; i++ )
            row.snapshotItem( i ).style.width = width;

    update_item( sid, skill.val );
}

// add an inventory item to the group (or refresh if it's already there)
function draw_new_misc (group, inv)
{
    if( !group || !group.group )
        return;

    var lst   = document.getElementById( group.group );

    if( !lst )
        return;

    var gid   = lst.getAttribute( 'id' );
    var iid   = gid + '.' + inv.key;
    var width = group_label_col_width( group );
    var iqty  = get_dom_node( iid );

    if( iqty )
    {
        var iper = get_dom_node( iid + '.per' );

        iqty.textContent = '' + inv.val;
        if( iper )
            iper.textContent = '' + inv.per;
    }
    else
    {
        var iel = make_item( lst, gid, inv, width, 0 );
        activate_input_fields( iel, "after" );
    }

    var row = xpath( 'dt', lst );

    if( row )
        for( var i = 0; i < row.snapshotLength; i++ )
            row.snapshotItem( i ).style.width = width;

    update_item( iid, inv.val );
}

// =========================================================================
// UI for new skills/runes etc

function field_widget (f,g)
{
    var widget;
    var etype = f.type;
    var wid   = 'new-item-widget-' + f.name;
    var label = div( 'class', 'new-item-field-label'  );
    var multi = f.multi;

    label.textContent  = ucfirst( f.name ) + ':';

    if( (typeof( etype ) == "string") && (etype == 'runes') )
    {
        etype = [];
        for( const r in rune_glyph )
            etype.push( r + ':' + rune_glyph[r] + ' ' + r );
    }

    if ( typeof( etype ) == "function" )
    {
        widget = etype( wid );
    }
    else if( typeof( etype ) == "string" )
    {
        var ec = 'new-item-field-widget editable ' + etype;
        widget = div( 'id', wid, 'class', ec );
        widget.contentEditable = "true";
        widget.addEventListener( 'keydown', suppress_input  );
        switch( etype )
        {
            case "text": widget.textContent = "-"; break;
            case "base": widget.textContent = "0"; break;
            case "uint": widget.textContent = "0"; break;
            case "uflt": widget.textContent = "0.0"; break;
        }
    }
    else if ( Array.isArray( etype ) )
    {
        var ec  = 'new-item-field-widget choice';
        var sel = element( 'select', 'id', wid );

        if( multi )
            sel.setAttribute( 'multiple', 'true' );

        widget = div( 'class', ec );
        widget.appendChild( sel );

        for( const o of etype )
        {
            var m;
            var text;
            var value;

            if( m = /^(\S+?)(?::(.*))?$/.exec( '' + o ) )
            {
                value = m[ 1 ];
                text  = m[ 2 ] || m[ 1 ];
            }
            else
            {
                value = text = '' + o;
            }

            var opt = element( 'option', 'value', value );
            opt.textContent = ucfirst( text );
            sel.appendChild( opt );
        }
    }
    return [ label, widget ];
}

function rune_cults (id)
{
    var ec  = 'new-item-field-widget choice';
    var sel = element( 'select', 'id', id );
    var rpg = get_group( 'rp' );

    var widget = div( 'class', ec );
    widget.appendChild( sel );

    for( const o of rpg.items )
    {
        var opt = element( 'option', 'value', o.key );
        opt.textContent = o.label || ucfirst( o.key );
        sel.appendChild( opt );
    }

    return widget;
}

function weapon_classes (id, wgroup)
{
    var ec  = 'new-item-field-widget choice';
    var sel = element( 'select', 'id', id );

    var widget = div( 'class', ec );
    widget.appendChild( sel );

    var def = element( 'option', 'value', '' );
    def.textContent = '-';
    sel.appendChild( def );

    for( const o in weapon_categories[ wgroup ] )
    {
        var opt = element( 'option', 'value', wgroup + '.' + o );
        opt.textContent = ucfirst( o );
        sel.appendChild( opt );
    }

    return widget;
}

function draw_default_input_form (grp, type)
{
    dismiss_input_forms();

    var template = extn_template[ type ];
    var group    = get_group( grp );

    if( !template || !group )
        return;

    var fid  = grp + '.new.' + type + '.form';
    var form = div( 'id', fid, 'class', 'new-item-form' );

    var label = div( 'class', 'new-item-form-title' );
    label.textContent = group.label  + ' ► ' + ucfirst( type );
    label.appendChild( element( 'input' ,
                                 'id'    , 'new-item-widget-group',
                                 'type'  , 'hidden',
                                 'value' , grp ) );
    form.appendChild( label );

    for( const f of template.fields )
        for( const i of field_widget( f, grp ) )
            form.appendChild( i );

    var cancel = div( 'class', 'new-item-form-cancel' );
    cancel.textContent = "Cancel";
    cancel.addEventListener( 'click', dismiss_this_form );

    var save = div( 'class', 'new-item-form-save' );
    save.textContent = "Add Item";
    save.addEventListener( 'click', function(){ process_form( fid, type ); } );

    form.appendChild( cancel );
    form.appendChild( save );
    document.body.appendChild( form );

    return form;
}

function weapon_label (n,h)
{
    return ucfirst( n.replace( '-', ' ' ) ) + ' (' + h + '🖐)';
}

function redraw_weapon_presets (e)
{
    var csel = this;

    if( !csel ) return;
    if( csel.nodeName != 'SELECT' )  return;

    const pid = csel.getAttribute( 'data-preset-id' );
    if( !pid ) return;

    var psel = get_dom_node( pid );
    if( !psel ) return;

    var cat = csel.value;
    if( !cat ) return;

    var xcat = split_id( cat );
    var wgrp = xcat[ 0 ];
    var wcat = xcat[ 1 ];
    if( !weapon_categories[ wgrp ] ) return;

    // strip out everything under psel except the first <option>
    var n = 0;
    var remove = [];
    for( const c of psel.childNodes )
    {
        switch( c.nodeType )
        {
          case Node.ELEMENT_NODE:
              if( n++ )
                  remove.unshift( c );
              break;
          default:
              remove.unshift( c );
        }
    }

    for( const c of remove )
        psel.removeChild( c );

    var presets = weapons[ wgrp ] ? weapons[ wgrp ][ wcat ] : null;

    if( !presets || !presets.length )
        return;

    for( const h of [1, 2] )
    {
        for( const k in presets[ h ] )
        {
            var ltxt = weapon_label( k, h );
            var opt  = element( 'option', 'value', cat + '.' + h + '.' + k );
            opt.textContent = ltxt;
            psel.appendChild( opt );
        }
    }

    psel.selectedIndex = 0;

    return psel;
}

function apply_weapon_presets (e)
{
    var psel = this;

    if( !psel ) return;
    if( psel.nodeName != 'SELECT' )  return;

    var key  = psel.value;
    if( !key ) return;

    var m; // does the key look sane?
    if( !(m = /^(.+?)\.(.+?)\.(\d+?)\.(.*)$/.exec( key ) ))
        return;

    var ctype = m[ 1 ]; // melee, missile, etc…
    var wcat  = m[ 2 ]; // axe, club, bow, etc…
    var hands = m[ 3 ]; // ✋×?
    var name  = m[ 4 ];

    // do we have any preset data?
    var preset = ( weapons[ ctype ] &&
                   weapons[ ctype ][ wcat ] &&
                   weapons[ ctype ][ wcat ][ hands ] &&
                   weapons[ ctype ][ wcat ][ hands ][ name ] );

    for( const map of [ [ 'str'  ] ,
                        [ 'dex'  ] ,
                        [ 'dam'  ] ,
                        [ 'sr'   ] ,
                        [ 'base' ] ,
                        [ 'type' ] ,
                        [ 'hands', hands ],
                        [ 'skill', weapon_label( name, hands ) ] ] )
    {
        var key = map[ 0 ];
        var id  = 'new-item-widget-' + key;
        var val = map[ 1 ] || preset[ key ];
        var ui  = get_dom_node( id );

        if( !ui ) continue;

        if( ui.nodeName == 'SELECT' )
            set_select_element_by_value( ui, '' + val );
        else
            ui.textContent = '' + val;
    }
}


function draw_weapon_input_form (grp, type)
{
    var ui = draw_default_input_form( grp, type );

    if( !ui )
        return;

    const cid = 'new-item-widget-class';
    const pid = 'new-item-widget-preset';
    var csel  = get_dom_node( cid );

    if( !csel )
        return;

    var ldiv = div( 'class', 'new-item-field-label' );
    var pdiv = div( 'class', 'new-item-field-widget choice');

    ldiv.textContent = "Preset: ";

    var psel = element( 'select', 'id' , pid,  'data-class-id', cid );
    var popt = element( 'option', 'value', "" );

    csel.setAttribute( 'data-preset-id', pid );
    popt.textContent = "-";
    psel.appendChild( popt );
    pdiv.appendChild( psel );

    csel.removeEventListener( 'change', redraw_weapon_presets );
    csel.addEventListener   ( 'change', redraw_weapon_presets );
    psel.addEventListener   ( 'change', apply_weapon_presets  );

    if( csel.value )
        redraw_weapon_presets.apply( csel, [] );

    // add the divs either before the class selector's
    // junior sibling, or at the end of the class selector's
    // container if it is the last child.
    var insert    = csel.parentElement ? csel.parentElement.nextSibling : null;
    var container = csel.parentElement ? csel.parentElement.parentElement : null;

    if( insert )
    {
        container.insertBefore( ldiv, insert );
        container.insertBefore( pdiv, insert );
    }
    else
    {
        container.appendChild( ldiv );
        container.appendChild( pdiv );
    }

    return ui;
}
// =========================================================================
// Handle input from new-skill-etc forms

function process_form (id,type)
{
    var form = document.getElementById( id );

    if( !form )
        return;

    var template = extn_template[ type ];

    if( !template )
        return;

    var data = {};

    var grp = document.getElementById( 'new-item-widget-group' );
    if( grp && grp.value )
        data[ 'group' ] = grp.value;

    for( const f of template.fields )
    {
        var wid   = 'new-item-widget-' + f.name;
        var path  = "descendant::*[@id='" + wid + "']";
        var nodes = xpath( path, form );

        if( nodes.snapshotLength != 1 )
            continue;

        var widget = nodes.snapshotItem( 0 );
        var value = false;

        if( widget.options )
        {
            if( widget.selectedOptions.length == 1 )
            {
                value = widget.options[widget.selectedIndex].value;
            }
            else if( widget.selectedOptions.length > 1 )
            {
                value = [];
                for( const o of widget.selectedOptions )
                    value.push( o.value );
            }
        }
        else if( typeof( f.type ) == "string" )
        {
            value = widget.textContent;
        }

        data[ f.name ] = value;
    }

    var status = template.save( data );
    var panel;

    switch( status )
    {
        case true:
            dismiss_input_forms();
            return;
        default:
            if( panel = document.getElementById( 'result' ) )
                clear_element( panel, status );
            return;
    }
}

function dismiss_input_forms ()
{
    var forms = document.getElementsByClassName( 'new-item-form' );

    if( !forms )
        return;

    for( const f of forms )
        f.parentNode && f.parentNode.removeChild( f );
}

function dismiss_this_form ()
{
    var button = this;
    var parent;
    var ancestor;

    if( button )
        if( parent = button.parentElement )
            if( ancestor = parent.parentElement )
                ancestor.removeChild( parent );
}

function label_to_key (label)
{
    var l = ('' + label).toLowerCase();
    var matched;
    var generic  = '';
    var specific = '';

    if( matched = /^\s*(.+?)\s*\((.+?)\)/.exec( l ) )
    {
        generic  = matched[ 1 ];
        specific = matched[ 2 ];
    }
    else if( matched = /^\s*(.+?)\s*$/.exec( l ) )
    {
        generic = matched[ 1 ];
    }
    else // should be impossible but just in case:
    {
        generic = '' +  l;
    }

    generic  = generic.replace ( / /g, '-' );
    specific = specific.replace( / /g, '-' );
    generic  = generic.replace ( /[🖐✋👊]/gu, 'H' );
    specific = specific.replace( /[🖐✋👊]/gu, 'H' );

    return generic + (specific ? ('.' + specific) : '' );
}

function detach_from (node, what)
{
    while( node.parentElement &&
           node.parentElement.nodeName != what )
        node = node.parentElement;

    node.parentElement.removeChild( node );
}

function delete_user_item (e)
{
    var clicked = this;
    var id      = clicked.getAttribute( 'data-ge-id' );
    var skill   = get_dom_node( id );

    if( !ui_delete_ok )
    {
        var panel = get_dom_node( 'result' );
        clear_element( panel, '🔏 Unlock UI to delete items' );
        return;
    }

    if( !skill_is_standard( id ) )
        del_entry( id );

    storage.del( id );

    for( var n of [ skill, clicked ] )
        detach_from( n, "DL" );
}
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function add_new_emotion (form_data)
{
    var group = get_group( form_data.group );

    if( !group )
        return "Cannot add entry to group " + form_data.group;

    var what    = form_data.type;
    var target  = form_data.subject;
    var label   = ucfirst( what ) + ' (' + target + ')';
    var key     = label_to_key( label );
    var level   = form_data.level * 1;

    if( !key )
        return "'" + label + "' is not a recognised emotion";

    if( level < 0 )
        return "Intensity (" + level + ") cannot be less than zero";

    var exists;
    if( exists = get_entry( group.group + '.' + key ) )
        return "Passion " + item_label( exists ) + " already exists";

    var emo = { key:     key     ,
                type:   'emotion',
                subtype: what    ,
                label:   label   ,
                target:  target  ,
                val:     level   };

    group.items.push( emo );
    draw_new_skill( group, emo );
    return true;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function debug_new_skill (form_data)
{
    console.log( form_data );
    return true;
}
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function add_new_runespell (form_data)
{
    var group = get_group( form_data.group );

    if( !group )
        return "Cannot add entry to group " + form_data.group;

    var label = form_data.name;
    var runes = form_data.runes;
    var cult  = form_data.cult;
    var cost  = form_data.cost * 1;
    var key   = cult + '.' + label_to_key( label );

    if( typeof( runes ) == 'string' )
        runes = [ runes ];

    if( !key )
        return "'" + label + "' is not a useful skill name";

    if( cost < 0 )
        return "Cost (" + cost + ") cannot be less than zero";

    var exists;
    if( exists = get_entry( group.group + '.' + key ) )
        return "Rune Spell " + item_label( exists ) + " already listed";

    var spell = { key:   key,
                  type: 'runespell',
                  label: label,
                  cult:  cult,
                  val:   cost,
                  runes: runes };

    group.items.push( spell );
    draw_new_runespell( group, spell );

    return true;
}
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function add_new_skill (form_data)
{
    var group = get_group( form_data.group );

    if( !group )
        return "Cannot add entry to group " + form_data.group;

    var label = form_data.skill;
    var base  = form_data.base * 1;
    var level = form_data.level * 1;
    var key   = label_to_key( label );

    if( !key )
        return "'" + label + "' is not a useful skill name";

    if( base < 0 )
        return "Base (" + base + ") cannot be less than zero";

    if( level < 0 )
        return "Score (" + level + ") cannot be less than zero";

    var exists;
    if( exists = get_entry( group.group + '.' + key ) )
        return "Skill " + item_label( exists ) + " already exists";

    var skill = { key: key, type: 'stat', label: label,
                  base: base, val: level };
    group.items.push( skill );
    draw_new_skill( group, skill );
    return true;
}
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function add_new_weapon (form_data)
{
    var group = get_group( form_data.group );

    if( !group )
        return "Cannot add entry to group " + form_data.group;

    var label = form_data.skill;
    var base  = form_data.base  * 1;
    var level = form_data.level * 1;
    var key   = label_to_key( label );
    var cat   = group.group + '.' + ''

    var exists;
    if( exists = get_entry( group.group + '.' + key ) )
        return "Skill " + item_label( exists ) + " already exists";

    var skill = { key  : key   ,
                  label: label ,
                  type : 'weapon',
                  cat  : form_data.class ,
                  dam  : form_data.dam   ,
                  dtype: form_data.type  ,
                  hands: form_data.hands * 1 ,
                  sr   : form_data.sr    * 1 ,
                  str  : form_data.str   * 1 ,
                  dex  : form_data.dex   * 1 ,
                  base : form_data.base  * 1 ,
                  val  : form_data.level * 1 };

    group.items.push( skill );
    draw_new_skill( group, skill );
    return true;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function add_new_rp (form_data)
{
    var group = get_group( form_data.group );

    if( !group )
        return "Cannot add entry to group " + form_data.group;

    var label = form_data.deity;
    var total = form_data.points * 1;
    var key   = label_to_key( label );

    if( !key )
        return "'" + label + "' is not a useful deity name";

    if( total < 0 )
        return "Total (" + total + ") cannot be less than zero";

    var exists;
    if( exists = get_entry( group.group + '.' + key ) )
        return "Link to " + item_label( exists ) + " already exists";

    var skill = { key: key, type: 'rp', label: label, cur: total, val: total };
    group.items.push( skill );
    draw_new_rp( group, skill );
    return true;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function add_new_misc (form_data)
{
    var group = get_group( form_data.group );

    if( !group )
        return "Cannot add entry to group " + form_data.group;

    var label = form_data.label;
    var total = form_data.quantity * 1;
    var key   = label_to_key( label );
    var per   = ( isNaN( form_data[ 'value/each' ] ) ?
                  0 :
                  (form_data[ 'value/each' ] * 1) );

    if( !key )
        return "'" + label + "' is not a useful inventory label";

    if( total < 0 )
        return "Total (" + total + ") cannot be less than zero";

    var exists;
    if( exists = get_entry( group.group + '.' + key ) )
        return "Entry for " + item_label( exists ) + " already exists";

    var inv = { key: key, type: 'misc', label: label, val: total, per: per };
    group.items.push( inv );
    draw_new_misc( group, inv );
    return true;
}

// =========================================================================
// derived stat calculations

function calc_enc ()
{
    var str = get_entry( 'stats.str' );
    var con = get_entry( 'stats.con' );

    if( !str || !con )
        return;

    var enc = document.getElementById( 'derived.enc' );

    if( !enc )
        return;

    var sv  = str.val * 1;
    var cv  = con.val * 1;

    enc.textContent = '' + ( (sv <= cv) ? sv : (maths.round( (sv + cv) / 2 )) );
}

function calc_mp ()
{
    var pow = get_entry( 'stats.pow' );
    var mp = document.getElementById( 'derived.mp' );

    if( !pow || !mp )
        return;

    mp.textContent = '' + pow.val;
}

function calc_siz_sr ()
{
    var siz = get_entry( 'stats.siz' );
    var sr  = document.getElementById( 'derived.srs' );

    if( !siz )
        return;

    var val = siz.val * 1;

    sr.textContent = '' +
        ( (val <=  6) ? 3 :
          (val <= 14) ? 2 :
          (val <= 21) ? 1 : 0 );
}

function calc_dex_sr ()
{
    var dex = get_entry( 'stats.dex' );
    var sr  = document.getElementById( 'derived.srd' );

    if( !dex )
        return;

    var val = dex.val * 1;

    sr.textContent = '' +
        ( (val <=  5) ? 5 :
          (val <=  8) ? 4 :
          (val <= 12) ? 3 :
          (val <= 15) ? 2 :
          (val <= 18) ? 1 : 0 );
}

function calc_sp_dam ()
{
    var pow = get_entry( 'stats.pow' );
    var cha = get_entry( 'stats.cha' );
    var spd = document.getElementById( 'derived.spd' );

    if( !pow || !cha )
        return;

    var val = (pow.val * 1) + (cha.val * 1);

    spd.textContent =
        ( (val <= 12) ? '1d3'   :
          (val <= 24) ? '1d6'   :
          (val <= 32) ? '1d6+1' :
          (val <= 40) ? '1d6+3' :
          (val <= 56) ? '2d6+3' :
          ''  + (maths.ceil( (val - 56) / 16.0 ) + 2) + 'd6' +
          '+' + (maths.ceil( (val - 56) / 16.0 ) + 3) );
}

function calc_damage ()
{
    var str = get_entry( 'stats.str' );
    var siz = get_entry( 'stats.siz' );
    var dam = document.getElementById( 'derived.dam' );

    if( !str || !siz )
        return;

    var val = (str.val * 1) + (siz.val * 1);

    dam.textContent =
        ( (val <= 12) ? '-1d4' :
          (val <= 24) ? '0'    :
          (val <= 32) ? '+1d4' :
          (val <= 40) ? '+1d6' :
          '+' + (maths.ceil( (val - 40) / 16.0 ) + 1) + 'd6' );
}

function calc_healrate ()
{
    var con = get_entry( 'stats.con' );
    var hlr = document.getElementById( 'derived.hlr' );

    if( !con )
        return;

    hlr.textContent = '' + maths.ceil( con.val * 1 / 6.0 );
}

function calc_max_hp ()
{
    var con = document.getElementById( 'stats.con' );
    var siz = document.getElementById( 'stats.siz' );
    var pow = document.getElementById( 'stats.pow' );

    if( !con || !siz || !pow )
        return;

    var cv = con.textContent * 1;
    var sv = siz.textContent * 1;
    var pv = pow.textContent * 1;

    var hp =
        ( cv + maths.ceil( sv / 4.0 ) - 3 +
          ( (pv <= 4 ) ? -1 :
            (pv <= 16) ?  0 : maths.ceil( (pv - 16) / 4.0 ) ) );

    var hit = document.getElementById( 'derived.hp' );
    if( hit )
    {
        hit.textContent = '' + hp;
        update_hitpoints();
    }
}

// =========================================================================
// hitpoint calculations

const hits = { legl: [0,1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7] ,
               legr: [0,1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7] ,
               arml: [0,1,1,1,2,2,2,3,3,3,3,3,3,4,4,4,5,5,5,6,6,6] ,
               armr: [0,1,1,1,2,2,2,3,3,3,3,3,3,4,4,4,5,5,5,6,6,6] ,
               body: [0,1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7] ,
               chest:[0,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,8,8,8,9,9,9] ,
               head: [0,1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7] };

function max_hp_for_area (area,maxhp)
{
    if( !hits[ area ] )
        return 0;

    if( maxhp < 0 )
        return 0;

    if( maxhp >= hits[ area ].length )
        return hits[ area ][ hits[ area ].length - 1 ];

    return hits[ area ][ maxhp ];
}

function update_hitpoints ()
{
    var master = document.getElementById( 'derived.hp' );
    var maxhp  = master ? (master.textContent * 1) : 0;
    var max;
    var cur;
    var loss = 0;

    // add up the hitpoints currently lost from each area
    for( const area of Object.keys( hits ) )
    {
        var mid = 'hitpoints.' + area + '.max';
        var cid = 'hitpoints.' + area + '.cur';

        var new_hp = max_hp_for_area( area, maxhp );
        var delta  = 0;

        // figure out what, if any, maxhp change applies to this area
        if( max = document.getElementById( mid ) )
        {
            // hitpoints start with an invalid value of '-'
            // which we should ignore:
            var old_hp = max.textContent;
            if( isNaN(old_hp) )
                old_hp = new_hp;
            else
                old_hp = old_hp * 1;

            delta = new_hp - old_hp;
            max.textContent = '' + new_hp;
        }

        // update the current hitpoints, remembering to
        // adjust upwards or downwards for any max hp change,
        // as well as any current injuries, and
        // keep a running total of injuries
        if( cur = document.getElementById( cid ) )
        {
            var cur_hp = cur.textContent * 1;

            if( delta )
            {
                cur_hp += delta;
                cur.textContent = '' + cur_hp;
            }

            loss += (new_hp - (cur.textContent * 1));
        }
    }

    if( max = document.getElementById( 'hitpoints.total.max' ) )
        max.textContent = '' + maxhp;

    // apply the running injury total to the current hp:
    if( cur = document.getElementById( 'hitpoints.total.cur' ) )
        cur.textContent = '' + (maxhp - loss);
}

function reset_hitpoints (e)
{
    var master = document.getElementById( 'derived.hp' );
    var maxhp  = master ? (master.textContent * 1) : 0;
    var max;
    var cur;
    var loss = 0;

    for( const area of Object.keys( hits ) )
    {
        var mid = 'hitpoints.' + area + '.max';
        var cid = 'hitpoints.' + area + '.cur';
        var hp  = hits[ area ][ maxhp ];
        if( max = document.getElementById( mid ) )
            if( cur = document.getElementById( cid ) )
                cur.textContent = max.textContent = '' + hp;
        if( cur )
            update_item( cid, hp, true );
    }

    if( max = document.getElementById( 'hitpoints.total.max' ) )
        if( cur = document.getElementById( 'hitpoints.total.cur' ) )
            cur.textContent = max.textContent = '' + maxhp;
    if( cur )
        update_item( 'hitpoints.total.cur', hp, true );
}

// =========================================================================
// roll them bones
function result_type_to_buff (s)
{
    switch( s )
    {
        case "CRIT!"  : return  50; break;
        case "SPEC!"  : return  30; break;
        case "PASS"   : return  20; break;
        case "FAIL"   : return -20; break;
        case "FUMBLE!": return -50; break;
        default:
            return 0; // this… can't happen?
    }
}

function roll_d100 (result, raw_skill, skill, prefix)
{
    if( isNaN( skill ) || raw_skill <= 0 )
    {
        if( result )
            result.textContent = (prefix ? prefix + " " : '') + 'Unavailable';

        return [ undefined, 'UNAVAILABLE' ];
    }
    var rolled = maths.floor( maths.random() * 100 ) + 1;

    // these range calculations ignore the fact that 1-5 is always a success:
    // this contradicts the written description in the core book, but agrees
    // with the pre-calculated charts provided therein:
    var crit   = maths.round( skill / 20 );
    var spec   = maths.round( skill / 5  );
    var label  = "";
    // 01-05 always OK; skill never > 95 for the roll
    // skill > 95 does extend the crit and special ranges
    var adjlev = ( skill < 5 ) ? 5 : ( (skill > 95) ? 95 : skill );
    var fumble = 101 - maths.round( (100 - skill)/ 20 );

    // 00 always fumbles
    if( fumble > 100 )
        fumble = 100;

    if( rolled == 1 || rolled <= crit )
        label = "CRIT!";
    else if( rolled <= spec )
        label = "SPEC!";
    else if( rolled <= adjlev )
        label = "PASS";
    else if( rolled < fumble )
        label = "FAIL";
    else
        label = "FUMBLE!";

    if( result )
    {
        clear_element( result, '🎲' );
        result.textContent  = prefix ? (prefix + " ") : '';
        result.textContent += rolled + "/" + skill;
        if( label )
            result.textContent += " = " + label;
    }

    if( one_shot_buff_on )
    {
        one_shot_buff_on = false;
        one_shot_buff_val = result_type_to_buff( label );

        if( result )
        {
            var klaxon = div();
            klaxon.textContent =
                "Next skill roll buffed by " + one_shot_buff_val;
            result.appendChild( klaxon );
        }
    }
    // we seek inspiration but have not yet achieved it
    else if (auto_buff_on == true)
    {
        auto_buff_val = result_type_to_buff( label );
        auto_buff_on  = 'unselected';

        if( result )
        {
            var klaxon = div();
            klaxon.textContent =
                ( auto_buff_val > 0 ? "Inspiration!" : "Despair." ) +
                " Click the 🎲 next to a skill to choose it.";
            result.appendChild( klaxon );
        }
    }

    return [ rolled, label ];
}

function roll_damage (result, outcome, text, data)
{
    var damage = data.dam || 0;
    var bonus  = (get_entry( 'derived.dam' ) || { val: 0 }).val;
    var bspec  = (bonus == '0') ? '' : (isNaN(bonus) ? bonus : ('+' +  bonus));
    var dspec;
    var rolled;

    switch( outcome )
    {
      case 'CRIT!':
          switch (data.dtype)
          {
            case 'C': // critical crushes are the same as specials below
                dspec = damage + bspec;
                if( bonus )
                    dspec += '+' + roll_ndxseq( false, bspec, true )[ 0 ];
                break;
            case 'SI':
            case 'S':
            case 'I':
            default:
                // max(2×damage) + bonus
                dspec = damage + '+' + damage;
                dspec = roll_ndxseq( false, dspec, true )[ 0 ] + bspec;
                break;
          }
          break;
      case 'SPEC!':
          switch (data.dtype)
          {
            case 'C':
                // crush: damage + bonus + max(bonus)
                dspec = damage + bspec;
                if( bonus )
                    dspec += '+' + roll_ndxseq( false, bspec, true )[ 0 ];
                break;
                // slash or impale: 2×damage + bonus
            case 'SI':
            case 'S':
            case 'I':
            default:
                dspec = damage + '+' + damage + bspec;
                break;
          }
          break;
      default:
          dspec = damage + bspec;
    }

    rolled = roll_ndxseq( false, dspec , false );

    if( result )
    {
        var rdtext = element( 'span' );
        var loctxt = element( 'span' );
        var tgt    = split_id( data.cat || 'melee.' )[ 0 ];
        var how    = (tgt == 'missile') ? 'hit.missile' : 'hit.melee';
        var hit    = roll_hit_location( false, how );

        result.textContent = text || '';
        rdtext.textContent = '💥' + rolled[ 1 ];
        loctxt.textContent = '🞋' + hit.desc;

        if( text )
            result.appendChild( element('br') );

        result.appendChild( rdtext );
        result.appendChild( element('br') );
        result.appendChild( loctxt );
    }

    return rolled;
}

function apply_skill_constraints (data, skill)
{
    var min_str = (data.str || 0) * 1;
    var min_dex = (data.dex || 0) * 1;
    var str     = (get_entry( 'stats.str' ) || { val: 0 }).val * 1;
    var dex     = (get_entry( 'stats.dex' ) || { val: 0 }).val * 1;
    var adjust  = 1;

    // strength can provide a dex bonus only if there's
    // a minimum strength requirement (and we exceed it)
    if( min_str )
    {
        if( str <  min_str )
            adjust = 0.5;
        else // excess strength adds to effective dex at a 2:1 ratio
            dex += (str - min_str) * 0.5;
    }

    if( min_dex && (dex < min_dex) )
        adjust = 0.5;

    return skill * adjust;
}

function fumble_rule (n)
{
    for( const r of fumble_results )
        if( (n >= r[ F_MIN ]) && (n <= r[ F_MAX ]) )
            return r;
    return [ 0, 0, -1, "There's no fumble rule at " + n ];
}

function process_ftoken( token, data )
{
    var damage;
    var bonus;

    switch( token )
    {
      case '{{damage}}':
          // ordinarydamage roll:
          return roll_damage( false, 'PASS', '', data )[ 0 ];
      case '{{DAMAGE}}':
          // max damage + ordinary bonus:
          damage = roll_ndxseq( false, data.dam, true )[ 0 ]
          bonus  = roll_ndxseq( false, get_entry('derived.dam').val )[ 0 ];
          return '' + ( (1 * damage) + (1 * bonus) );
      case '{{CRITICAL!}}':
          // critical damage roll:
          damage = roll_damage( false, 'CRIT!', '', data );
          console.log( token + ' ' + damage[ 1 ] );
          return damage[ 0 ];
      case '{{hit.melee}}':
          damage = roll_hit_location( false, 'hit.melee' );
          return damage.name + ' (' + damage.loc + ')';
      case '{{item}}':
          return data.label;
      case '{{compass}}':
          return [ 'north', 'northeast' ,
                   'east' , 'southeast' ,
                   'south', 'southwest' ,
                   'west' , 'northwest' ][ roll_ndx('1d8') - 1 ];
    }

    var m;
    if( m = /\{\{F(\d+)\}\}/.exec( token ) )
    {
        var rule = fumble_rule( m[ 1 ] * 1 );
        return process_fumble_text( rule[ F_RULE ] );
    }

    if( m = /\{\{([-+0-9d]+)\}\}/.exec( token ) )
        return roll_ndxseq( false, m[ 1 ], false )[ 0 ];

    return '??? ' + token + '???';
}

function process_fumble_text (r, data)
{
    const token = /(\{\{.+?\}\})/gu;
    const func  = function (m,p1) { return process_ftoken( p1, data ); };
    return [ r.replace( token, func ).split( '/' ) ];
}

function roll_fumble (result, type, text, data)
{
    var lines = [ text ];

    for( var f = 1; f > 0; )
    {
        var F = roll_ndx( '1d100' );
        var fumble = fumble_rule( F );
        var rule   = (type == 'parry') ? fumble[ F_PARRY ] : fumble[ F_RULE ];

        if( !rule )
            rule = fumble[ F_RULE ];

        // most rules reduce f by 1
        f += fumble[ F_LESS ];

        for( const r of rule.split( '/' ) )
            for( const p of process_fumble_text( r, data ) )
                lines.push( F + ': ' + p );
    }

    clear_element( result, '' );

    for( const l of lines )
    {
        var txt = element( 'span' );
        var brk = element( 'br' );

        txt.textContent = l;

        result.appendChild( txt );
        result.appendChild( brk );
    }
}

function roll_parry (result, raw_skill, skill, prefix, data)
{
    var weapon = split_id( data.cat );
    var group  = weapon[ 0 ];
    var name   = weapon[ 1 ];
    var alt;

    // missile weaspons parry with either the melee version of their skill
    // (cf javelin) or with the base + modifier value of quarterstaff
    // (ie NOT the fully trained quarterstaff skill):
    if( group == 'missile' )
    {
        if( (alt = get_entry( 'melee.' + name         )) ||
            (alt = get_entry( 'melee.' + name + '.1H' ))  )
        {
            var node;
            if( node = get_dom_node( 'melee.' + alt.key ) )
                skill = (node.textContent || 0) * 1;
        }
        else if( (alt = get_entry( 'melee.quarterstaff.1H' )) ||
                 (alt = get_entry( 'melee.quarterstaff.2H' )) )
        {
            var mmod = group_modifier( get_group( 'melee' ) );
            skill = ((alt.base || 0) * 1) + mmod;
        }
    }

    skill = apply_skill_constraints( data, skill );

    var d100    = roll_d100( false, raw_skill, skill, prefix );
    var rolled  = d100[ 0 ];
    var outcome = d100[ 1 ];
    var text    = ( (prefix ? (prefix + " ") : '🛡') +
                    rolled + "/" + skill + " Parry = "  + outcome );

    if( outcome == 'FUMBLE!' )
        return roll_fumble( result, 'parry', text, data );

    if( result )
        result.textContent = text;
}

function roll_attack (result, raw_skill, skill, prefix, data)
{
    if( isNaN( raw_skill ) || raw_skill <= 0 )
        return roll_d100( result, raw_skill, skill, prefix );

    skill = apply_skill_constraints( data, skill );

    var d100    = roll_d100( null, raw_skill, skill, prefix );
    var rolled  = d100[ 0 ];
    var outcome = d100[ 1 ];
    var text    = ( (prefix ? (prefix + " ") : '') +
                     rolled + "/" + skill + " = "   +
                     ((outcome == 'FAIL') ? 'MISSED' : outcome) );

    switch( outcome )
    {
      case 'FUMBLE!':
          return roll_fumble( result, 'attack', text, data );

      case 'FAIL':
          clear_element( result, '🎲' );
          result.textContent = text;
          return;

      default:
          return roll_damage( result, outcome, text, data );
    }
}

function roll_ndx (ndx, max)
{
    var seq = ndx.split('d');
    var n   = seq[ 0 ] * 1;
    var x   = seq[ 1 ] * 1;
    var r = 0;

    if( n < 1 )
        n = 1;

    if( x < 1 )
        return 0;

    for(var i = 0; i < n; i++)
        r += max ? x : (maths.floor( maths.random() * x )  + 1);

    return r;
}

const ndxre = /\d*d\d+|[+-]|\d+/g;
function roll_ndxseq (result, skill, max)
{
    var op = '+';
    var rolled = 0;
    var dice = [];
    var m;
    while( m = ndxre.exec( skill ) )
        dice.push( m[0] );

    for( const d of dice )
    {
        var r = 0;
        if( d == '+' || d == '-' ) { op = d; continue; }

        if( isNaN(d) ) { r = roll_ndx( d, max ); }
        else           { r = d * 1; }

        if( op == '+' ) { rolled += r; }
        else            { rolled -= r; }
    }

    var text = dice.join(' ') + ' = ' + rolled;

    if( result )
    {
        clear_element( result, '🎲' );
        result.textContent = text;
    }

    return [ rolled, text ];
}

function roll_nx (e)
{
    var nx = this.textContent;
    var found = /(\d+)×/u.exec( nx );

    e.stopPropagation();

    if( !found )
        return undefined;

    var attr  = document.getElementById( 'nxvalue' );
    var panel = document.getElementById( 'result'  );
    var label = document.getElementById( 'rlabel'  );

    if( !attr || ! panel )
        return undefined;

    var stat  = attr.textContent * 1;
    var multi = found[1] * 1;
    var text  = label ? label.textContent : '';

    if( multi > 1 )
        if( text = text.replace( /:\s*/, '' ) )
            text += '×' + multi + ': ';

    var skill = stat * multi;
    if( attr && panel )
        return roll_d100( panel, skill, skill, text );

    return undefined;
}

function roll_prune (panel, node, prune)
{
    var rid   = prune.getAttribute( 'id' );

    if( node && prune )
    {
        var label = ucfirst( split_id( rid )[ 1 ] ) + ':';
        var level = prune.textContent * 1;
        var glyph = ( node.textContent ?
                      node.textContent.replace( /^\s+|\s+$/g, '' ) :
                      '☯' );

        return roll_d100( panel, level, level, glyph + label );
    }

    return undefined;
}

function get_rune_level (r)
{
    var rdata = get_entry( 'rune.' + r );

    if( rdata )
        return rdata.val;

    var prune = get_group( 'prune' );

    for( const pr of prune.items )
    {
        switch( pr.subkeys.indexOf( r ) )
        {
          case 0: return pr.val;
          case 1: return 100 - pr.val;
        }
    }

    return 0;
}

function cast_runespell (panel, rune, id)
{
    var spell = get_entry( id );

    if( !spell )
    {
        panel.textContent = 'Unknown rune spell ' + id;
        return;
    }
    var cult  = spell.cult;
    var rp    = get_entry( 'rp.' + cult );

    if( !rp )
    {
        panel.textContent = 'Not an initiate of the ' + cult + ' cult';
        return;
    }

    var level = get_rune_level( rune );
    var glyph = rune_glyph[ rune ] || '☯';
    var cost  = spell.val * 1;

    if( rp.cur < cost )
    {
        panel.textContent = 'Not enough ' + rp.label + ' rune points';
        return;
    }

    var rv = roll_d100( panel, level, level, glyph + ' ' + spell.label );

    switch( rv[ 1 ] )
    {
      case 'FAIL':
      case 'FUMBLE':
          return rv;
    }

    var cid = 'rp.' + cult + '.cur';
    set_dom_node_text( cid, '' + ((rp.cur * 1) - cost), true );

    return rv;
}

function setup_nx_roll (panel, node, attr)
{
    var opt_group = div( 'class', 'nxroll' );
    var att_div   = div( 'id', 'nxvalue', 'class', 'rlabel' );
    var prev;

    clear_element( panel, '🎲' );
    att_div.textContent = '' +  attr

    if( node && node.parentNode )
        prev = node.parentNode.previousElementSibling;

    if( prev )
    {
        var ldiv = div( 'id', 'rlabel', 'class', 'rlabel' );
        ldiv.textContent = prev.textContent + ':';
        opt_group.appendChild( ldiv );
    }

    opt_group.appendChild( att_div );
    panel.appendChild( opt_group );

    for( var x = 0; x < 5; x++ )
    {
        var opt = div( 'class', 'nxopt' );
        opt.textContent = (x+1) + '×';
        opt.addEventListener( 'click', roll_nx );
        opt_group.appendChild( opt );
    }
}

function roll_hit_location (panel, node)
{
    var loc  = roll_ndx( "1d20" );
    var name = '';
    var id   = ( (typeof(node) == 'string') ?
                 node :
                 node.getAttribute( 'data-ge-id' )  ) || 'hit.generic';
    var type = split_id( id )[ 1 ];
    var text = '';

    switch( type )
    {
      case 'generic':
      case 'melee':
          switch( loc )
          {
            case 1:
            case 2:
            case 3:
            case 4:
                name = 'right leg';
                break;
            case 5:
            case 6:
            case 7:
            case 8:
                name = 'left leg';
                break;
            case 9:
            case 10:
            case 11:
                name = 'abdomen';
                break;
            case 12:
                name = 'chest';
                break;
            case 13:
            case 14:
            case 15:
                name = 'right arm';
                break;
            case 16:
            case 17:
            case 18:
                name = 'left arm';
                break;
            case 19:
            case 20:
                name = 'head';
                break;
            default:
          }
          break;
      case 'missile':
          switch( loc )
          {
            case 1:
            case 2:
            case 3:
                name = 'right leg';
                break;
            case 4:
            case 5:
            case 6:
                name = 'left leg';
                break;
            case 7:
            case 8:
            case 9:
            case 10:
                name = 'abdomen';
                break;
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
                name = 'chest';
                break;
            case 16:
            case 17:
                name = 'right arm';
                break;
            case 18:
            case 19:
                name = 'left arm';
                break;
            case 20:
                name = 'head';
                break;
            default:
          }
          break;
      default:
    }

    clear_element( panel, '🎲' );
    type = type == 'melee' ? 'Mêlée' : ucfirst( type );

    if( name )
        text = 'Hit (' + type + ') ' + loc + ' = ' + name;
    else
        text = '🥊 Bam! Right in the #' + loc;

    if( panel )
        panel.textContent = text;

    return { loc: loc, name: name, desc: text };
}

// =========================================================================

function load_group_data ()
{
    for( const s of storage.keys() )
    {
        var cur = get_entry( s );

        if( cur && cur.noedit ) // non-editable element, ignore cached values
            continue;

        const id = split_id( s );
        var   nv = storage.get( s );
        const group_name = id[ 0 ];
        const entry_name = id[ 1 ];
        var   group = get_group( group_name );
        var   i = 0;
        var   n = undefined;

        if( !group      ) continue;
        if( !entry_name ) continue;
        if( !nv         ) continue;

        nv = JSON.parse( nv );
        if( !nv         ) continue;

        for( i = 0; i < group.items.length && n == undefined; i++ )
            if( group.items[i]['key'] == entry_name )
                n = i;

        // new items are added to the predefined list as-is
        if( n == undefined )
        {
            group.items.push( nv );
        }
        else // preexisting items only load the base and value:
        {
            group.items[ n ].base = nv.base;
            group.items[ n ].val  = nv.val;
        }
    }
}

function clear_element (e,text)
{
    var c;

    if( !e )
        return;

    while( c = e.firstChild )
        e.removeChild( c );
    e.textContent = '';

    if( !text  )
        return;

    var txt = div( 'class', 'rlabel' );
    txt.textContent = text;
    e.appendChild( txt );
    return;
}

function clear_results (e)
{
    clear_element( this, '🎲' );
    return;
}

function choose_axis (a)
{
    switch( a )
    {
        case "under":
            return "descendant";
        case "after":
            return "following-sibling::*/descendant-or-self";
        default:
            if( !a )
                return "descendant";
    }

    return a;
}

function activate_dice (node, axis)
{
    var match = xmatch_class( 'roll' );

    if( !node )
        node = document.body;

    var path   = choose_axis( axis ) + "::*[" + match + "]"
    var target = xpath( path, node );

    //console.log( 'activating ' + target.snapshotLength + ' dice' );
    for( var n = 0; n < target.snapshotLength; n++ )
    {
        var node = target.snapshotItem( n );
        node.removeEventListener( 'click', do_something );
        node.addEventListener   ( 'click', do_something );
    }
}

function activate_input_fields (node, axis)
{
    var match = xmatch_class( 'editable' );

    if( !node )
        node = document.body;

    var path   = choose_axis( axis ) + "::*[" + match + "]"
    var target = xpath( path, node );

    //console.log( 'activating ' + target.snapshotLength + ' input fields' );
    for( var n = 0; n < target.snapshotLength; n++ )
    {
        var node = target.snapshotItem( n );
        node.contentEditable = "true";
        node.removeEventListener( 'input', handle_edit_event );
        node.addEventListener   ( 'input', handle_edit_event );
        node.removeEventListener( 'keydown', suppress_input  );
        node.addEventListener   ( 'keydown', suppress_input  );
    }

    return target;
}

function start_chained_buff (e)
{
    var panel = get_dom_node( 'result' );

    one_shot_buff_on = true;
    panel.textContent = "Make your buff/debuff roll";
}

function start_inspiration (e)
{
    var panel = get_dom_node( 'result' );

    auto_buff_on  = true;
    auto_buff_val = 0;
    panel.textContent = "Roll a passion or rune for inspiration";
}

function set_manual_buff (e)
{
    var from = this;
    var to;
    var cclass;
    var value = 0;

    if( cclass = this.getAttribute( 'class' ) )
        if( cclass.match( /manual-buff/ ) )
            value = this.textContent * 1;

    if( to = get_dom_node( 'bxx' ) )
    {
        to.textContent = '' + value;
        manual_buff_on = true;
        manual_buff_val = value;
    }
}

function toggle_tick_pending (e)
{
    var panel = get_dom_node( 'result' );

    if( tick_pending )
    {
        if( panel )
            clear_element( panel, '🎲' );

        tick_pending = false;
        return;
    }

    tick_pending = true;
    if( panel )
        clear_element( panel, '🎲 ← Activate a skill or rune to tick it' );
}

function toggle_ui_lock (e)
{
    var lock = get_dom_node( 'lock-ui' );
    var mesg = get_dom_node( 'result'  );

    if( ui_delete_ok )
    {
        ui_delete_ok = false;
        clear_element( lock, '🔏' );
        clear_element( mesg, '🔏 UI locked, items cannot be deleted' );
    }
    else
    {
        ui_delete_ok = true;
        clear_element( lock, '🔓' );
        clear_element( mesg, '🔓 UI unlocked, items CAN be deleted' );
    }
}

function activate_buffctl ()
{
    var karate = get_dom_node( 'wax-on-wax-off' );

    if( karate )
    {
        karate.removeEventListener( 'click', toggle_manual_buffs );
        karate.addEventListener   ( 'click', toggle_manual_buffs );
    }

    var match  = xmatch_class( 'manual-buff' );
    var updown = xpath( "//*[" + match + "]" );
    var btn;

    if( updown )
        for( var i = 0; i < updown.snapshotLength; i++ )
            if( btn = updown.snapshotItem( i ) )
            {
                btn.removeEventListener( 'click', set_manual_buff );
                btn.addEventListener   ( 'click', set_manual_buff );
            }

    var chain = get_dom_node( 'one-shot-buff' );

    if( chain )
    {
        chain.removeEventListener( 'click', start_chained_buff );
        chain.addEventListener   ( 'click', start_chained_buff );
    }

    var inspire = get_dom_node( 'inspiration' );

    if( inspire )
    {
        inspire.removeEventListener( 'click', start_inspiration );
        inspire.addEventListener   ( 'click', start_inspiration );
    }

    var expire = get_dom_node( 'expiration' );

    if( expire )
    {
        expire.removeEventListener( 'click', unset_inspired_skill );
        expire.addEventListener   ( 'click', unset_inspired_skill );
    }
}

function activate_rgb_button ()
{

    var node;

    for( const x of [ [ 'rgb-button'    , 'click', toggle_palette ] ,
                      [ 'close-palette' , 'click', toggle_palette ] ,
                      [ 'reset-palette' , 'click', reset_palette  ] ,
                      [ 'save-palette'  , 'click', save_palette   ] ,
                      [ 'rr',             'input', slide_colour   ] ,
                      [ 'rg',             'input', slide_colour   ] ,
                      [ 'rb',             'input', slide_colour   ] ] )
    {
        if( !(node = get_dom_node( x[ 0 ] )) )
            continue;
        node.removeEventListener( x[ 1 ], x[ 2 ] );
        node.addEventListener   ( x[ 1 ], x[ 2 ] );
    }
}

function activate_io_buttons ()
{
    var node;

    for( const x of [ [ 'io-button',   'click', toggle_io_ui ] ,
                      [ 'save-button', 'click', export_data  ] ,
                      [ 'load-button', 'click', import_data  ] ] )
    {
        if( !(node = get_dom_node( x[ 0 ] )) )
            continue;
        node.removeEventListener( x[ 1 ], x[ 2 ] );
        node.addEventListener   ( x[ 1 ], x[ 2 ] );
    }
}

function activate_tick_button ()
{
    var node;

    if( !(node = get_dom_node( 'tick-button' )) )
        return;

    node.removeEventListener( 'click', toggle_tick_pending );
    node.addEventListener   ( 'click', toggle_tick_pending );
}

function activate_rpanel ()
{
    var node;

    if( !(node = get_dom_node( 'result' )) )
        return;

    node.removeEventListener( 'click', clear_results );
    node.addEventListener   ( 'click', clear_results );
}

function activate_ui_lock_toggle ()
{
    var node;

    if( !(node = get_dom_node( 'lock-ui' )) )
        return;

    node.removeEventListener( 'click', toggle_ui_lock );
    node.addEventListener   ( 'click', toggle_ui_lock );

}

function collect_colour_rules ()
{
    var sheets = document.styleSheets;
    var crules = {};

    for( var s = 0; s < sheets.length; s++ )
    {
        for( var r = 0; r < sheets[s].cssRules.length; r++ )
        {
            var cssr = sheets[ s ].cssRules[ r ];

            if( cssr instanceof CSSStyleRule )
            {
                var colour;
                for( const attr of [ 'color', 'background-color' ] )
                {
                    if( attr in cssr.style && cssr.style[ attr ])
                    {
                        if( colour = get_colour_value( cssr.style[ attr ] ) )
                        {
                            var selector = cssr.selectorText;
                            // never touch the palette elements themselves
                            // in case the user accidentally chooses illegible
                            // colours (eg white on white):
                            if( ! /#palette/.exec( selector ) )
                            {
                                if( !crules[ colour ] )
                                    crules[ colour ] = [];
                                crules[ colour ].push( [ s, r, selector, attr ] );
                            }
                        }
                    }
                }
            }
        }
    }

    return crules;
}

function add_std_weapon (grp,h,cat,k)
{
    var hands = h * 1;
    var label = weapon_label( k, hands );
    var key   = label_to_key( label );
    var id    = grp + '.' + key;
    var wtype = grp + '.' + cat;
    var group = get_group( grp );
    var entry = get_entry( id  );
    var raw   = weapons[ grp ][ cat ][ hands ][ k ];

    if( !group )
        return;

    standard_skills[ id ] = true;

    if( !entry )
    {
        var skill =
            {
                key  : key     ,
                label: label   ,
                type : 'weapon',
                cat  : wtype   ,
                dam  : raw.dam ,
                dtype: raw.type,
                hands: hands   ,
                sr   : raw.sr  ,
                str  : raw.str ,
                dex  : raw.dex ,
                base : raw.base,
                val  : 0       };
        group.items.push( skill );
    }
}

function generate_standard_weapons ()
{
    for( const arg of [ [ 'unarmed', 2, 'fist'   , 'fist'    ] ,
                        [ 'unarmed', 2, 'grapple', 'grapple' ] ,
                        [ 'unarmed', 0, 'kick'   , 'kick'    ] ,
                        [ 'shield' , 1, 'shield' , 'small-shield'  ] ,
                        [ 'shield' , 1, 'shield' , 'medium-shield' ] ,
                        [ 'shield' , 1, 'shield' , 'large-shield'  ] ,
                        [ 'melee'  , 2, 'staff'  , 'quarterstaff'  ] ] )
         add_std_weapon.apply( null, arg );
}

var initialised = 0;

function initialise ()
{
    var v;
    var editable;
    var pinfo;
    var node;
    const uint_allowed = "0123456789";
    const int_allowed  = "-" + uint_allowed;
    const uflt_allowed = "." + uint_allowed;
    const dice_allowed = "0123456789+-d ";
    const base_allowed = "abcdefghijklmnopqrstuvwxyz*." + uint_allowed;

    if( initialised )
        return;

    colour_scheme = collect_colour_rules();

    initialised = 1;

    generate_standard_weapons();

    for( const g of groups )
        for( const i of g.items )
            standard_skills[ g.group + '.' + i.key ] = true;

    load_group_data();

    add_stat_groups();

    calc_max_hp();
    calc_healrate();
    calc_damage();
    calc_sp_dam();
    calc_dex_sr();
    calc_siz_sr();
    calc_enc();
    calc_mp();

    pinfo = xpath( pinfo_pat );
    for( n = 0; pinfo && (n < pinfo.snapshotLength); n++ )
        if( node = pinfo.snapshotItem( n ) )
            if( v = node.getAttribute( 'id' ) )
                if( (v = storage.get( v )) != null )
                    node.textContent = v;

    activate_dice();

    activate_buffctl();

    activate_io_buttons();

    activate_rgb_button();

    activate_tick_button();

    activate_rpanel();

    activate_ui_lock_toggle();

    load_palette();

    editable = activate_input_fields();
    if( !editable || editable.snapshotLength <= 0 )
        return 0;

    // carriage return, newline
    for( const c in suppressed_keys )
        for( const k of [0xa, 0xd] )
            suppressed_keys[c][k] = true;

    // the digits
    for( var i = 0; i < uint_allowed.length; i++ )
        allowed_keys['uint'][uint_allowed.charCodeAt( i )] = true;
    for( var i = 0; i < uflt_allowed.length; i++ )
        allowed_keys['uflt'][uflt_allowed.charCodeAt( i )] = true;
    for( var i = 0; i < int_allowed.length; i++ )
        allowed_keys['int'][int_allowed.charCodeAt( i )] = true;

    // dice-spec
    for( var i = 0; i < dice_allowed.length; i++ )
        allowed_keys['dice'][dice_allowed.charCodeAt( i )] = true;

    // base-spec (eg "stats.dex*3" or "15")
    for( var i = 0; i < base_allowed.length; i++ )
        allowed_keys['base'][base_allowed.charCodeAt( i )] = true;

    // since the order is allow/deny with a first-match-wins strategy
    // we must specifically allow movement keys for restricted input
    // classes like uint: arrow keys + bs tab del
    for( const c in allowed_keys )
    {
        allowed_keys[c][46] = true;
        allowed_keys[c][8]  = true;
        allowed_keys[c][9]  = true;
        for( var i = 35; i <= 40; i++ )
            allowed_keys[c][i] = true;
    }

    return editable.snapshotLength;
}

function debug_skill_ranges ()
{
    // dump out the skill / crit / special / fumble values
    for( x = 1; x <= 110; x++ )
    {
        var a = maths.round( 100.99 - ((100 - x) / 20) );
        var skill = (x < 5) ? 5 : ((x > 95) ? 95 : x);
        var b = 101 - maths.round( (100 - x)/ 20 );
        var c = maths.round( x / 20 );
        var s = maths.round( x / 5 );
        console.log( x + " " + c + " — " + s + " — " + b );
    }
}

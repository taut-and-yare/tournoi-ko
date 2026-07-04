export const PETITE_FINALE = 'Petite finale';

export function roundName(playersInRound: number): string {
  switch (playersInRound) {
    case 2: return 'Finale';
    case 4: return 'Demi-finales';
    case 8: return 'Quarts de finale';
    case 16: return '8es de finale';
    case 32: return '16es de finale';
    default: return `Tour à ${playersInRound} joueurs`;
  }
}

export const t = {
  appTitle: 'Tournoi KO',
  homeIntro: 'Créez et suivez vos tournois d’échecs à élimination directe.',
  seeTournaments: 'Voir les tournois',
  tournamentsTitle: 'Tournois',
  addTournament: 'Ajouter un tournoi',
  noTournaments: 'Aucun tournoi pour le moment.',
  unlock: 'Déverrouiller',
  lock: 'Verrouiller',
  adminPrompt: 'Mot de passe organisateur',
  create: 'Créer',
  cancel: 'Annuler',
  save: 'Enregistrer',
  delete: 'Supprimer',
  edit: 'Modifier',
  name: 'Nom',
  startDate: 'Date de début',
  endDate: 'Date de fin',
  organiser: 'Organisateur',
  firstRoundByElo: 'Premier tour par ELO (fort contre faible)',
  participantCount: 'Nombre de participants',
  mustBePowerOfTwo: 'Le nombre de participants doit être une puissance de deux (2, 4, 8, 16…).',
  players: 'Joueurs',
  addPlayer: 'Ajouter un joueur',
  elo: 'ELO',
  lichess: 'Pseudo Lichess',
  photo: 'Photo',
  startTournament: 'Démarrer le tournoi',
  needExactPlayers: 'Ajoutez exactement le nombre de participants avant de démarrer.',
  registration: 'Inscriptions',
  active: 'En cours',
  complete: 'Terminé',
  currentRound: 'Tour actuel',
  previousRound: 'Tour précédent',
  nextRound: 'Tour suivant',
  advanceRound: 'Générer le tour suivant',
  recordResults: 'Saisir les résultats',
  white: 'Blancs',
  rapid: 'Cadence 10 min',
  blitz: 'Cadence 3 min + 2 s',
  armageddon: 'Armageddon',
  winner: 'Vainqueur',
  champion: 'Champion',
  thirdPlace: 'Créer la petite finale',
  petiteFinale: PETITE_FINALE,
  loading: 'Chargement…',
  notFound: 'Tournoi introuvable.',
  unauthorized: 'Non autorisé.',
  resultWhiteWin: 'Victoire des Blancs',
  resultBlackWin: 'Victoire des Noirs',
  resultDraw: 'Nulle',
  tournamentNotStarted: 'Le tournoi n’a pas encore démarré.',
  organiserModeNotice: 'Mode organisateur activé — panneaux de gestion à venir.'
};

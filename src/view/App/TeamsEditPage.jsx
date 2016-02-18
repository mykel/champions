import './TeamsEditPage.scss';
import teams, { synergiesFromChampions } from '../../service/teams';
import roster from '../../service/roster';
import deepEqual from 'deep-equal';
import ChampionTeamSelector from '../Champion/ChampionTeamSelector.jsx';
import ChampionPortrait from '../Champion/ChampionPortrait.jsx';
import { requestRedraw } from '../../util/animation';
/* eslint-disable no-unused-vars */
import m from 'mithril';
/* eslint-enable no-unused-vars */

function applyTeams(updatedTeams) {
    teams.result = {
        teams: updatedTeams,
        counts: {
            teams: 0,
            synergies: 0,
        },
        extras: [],
    };
    const inTeam = {};
    updatedTeams.forEach((team) => {
        teams.result.counts.teams++;
        teams.result.counts.synergies += team.synergies.length;
        team.champions.forEach((champion) => inTeam[ champion.id ] = true);
    });
    roster.filter((champion) => !inTeam[ champion.id ] && teams.stars[ champion.attr.stars ])
        .forEach((champion) => teams.result.extras.push(champion));
}

function calculateSynergies(swap) {
    const { source, target } = swap;
    if(source && target) {
        if(source.team && source.index !== undefined) {
            const champions = [ ...source.team.champions ];
            champions[ source.index ] = target.champion;
            source.synergies = synergiesFromChampions(champions);
        }
        else {
            source.synergies = [];
        }
        if(target.team && target.index !== undefined) {
            const champions = [ ...target.team.champions ];
            champions[ target.index ] = source.champion;
            target.synergies = synergiesFromChampions(champions);
        }
        else {
            target.synergies = [];
        }
    }
    else if(!target && source && source.create && source.champion) {
        const champions = [ ...source.team.champions ];
        champions[ source.index ] = null;
        source.synergies = synergiesFromChampions(champions);
    }
    else {
        if(source) {
            source.synergies = [];
        }
        if(target) {
            target.synergies = [];
        }
    }
}

const TeamsEditPage = {
    controller() {
        this.swap = {
            source: null,
            target: null,
        };
        this.create = { };
        this.teams = [];
        this.size = 0;
        this.stars = {};
        this.last = -1;
        this.reset = () => {
            const starsEqual = deepEqual(this.stars, teams.stars);
            if(this.last !== teams.last || this.size !== teams.size || !starsEqual) {
                if(this.size !== teams.size || !starsEqual) {
                    teams.result = null;
                    this.teams = [];
                }
                else {
                    this.teams = teams.result && teams.result.teams.map(({ champions, synergies }) => ({
                        champions: [
                            ...champions,
                        ],
                        synergies: [
                            ...synergies,
                        ],
                    })) || [];
                }
                this.swap.source = null;
                this.swap.target = null;
                this.create.champions = [ null ];
                this.create.synergies = [];
                this.stars = { ...teams.stars };
                this.size = teams.size;
                this.last = teams.last;
            }
        };
        this.apply = () => {
            const { source, target } = this.swap;
            if(source && target) {
                if(source.index !== undefined && source.team) {
                    source.team.champions[ source.index ] = target.champion;
                    source.team.synergies = synergiesFromChampions(source.team.champions);
                }
                if(target.index !== undefined && target.team) {
                    target.team.champions[ target.index ] = source.champion;
                    target.team.synergies = synergiesFromChampions(target.team.champions);
                }
                if(source.create && !source.team.champions.some((champion) => !champion)) {
                    this.teams.push(this.create);
                    this.create = {
                        champions: [ null ],
                        synergies: [],
                    };
                }
            }
            this.swap.source = null;
            this.swap.target = null;
            applyTeams(this.teams);
        };
    },

    view(ctrl) {
        ctrl.reset();
        let keys = 0;
        const { swap, create, teams } = ctrl;
        const { source, target } = swap;
        const targetId = target && target.champion && target.champion.id;
        const elements = [];
        const inTeam = {};
        teams.forEach(({ champions, synergies }, teamIndex) => {
            elements.push(
                <ChampionTeamSelector
                    key={ ++keys }
                    team={{
                        champions,
                        synergies,
                    }}
                    swap={ swap }
                    onclick={(index) => {
                        if(targetId === champions[ index ].id) {
                            swap.target = null;
                        }
                        else if (source && source.champion === champions[ index ]) {
                            swap.source = null;
                        }
                        else if(source && champions.some((champion) => source.champion === champion)) {
                            swap.source = {
                                team: teams[ teamIndex ],
                                champion: champions[ index ],
                                index,
                            };
                        }
                        else if(!source) {
                            swap.source = {
                                team: teams[ teamIndex ],
                                champion: champions[ index ],
                                index,
                            };
                            if(swap.target && swap.target.index) {
                                swap.target = null;
                            }
                        }
                        else {
                            swap.target = {
                                team: teams[ teamIndex ],
                                champion: champions[ index ],
                                index,
                            };
                            if(source && source.create && !source.champion) {
                                swap.source = null;
                            }
                        }
                        calculateSynergies(swap);
                        requestRedraw();
                    }}
                    onsplit={ source && champions.some((champion) => champion === source.champion) && !target && (() => {
                        ctrl.teams = teams.filter((element, index) => teamIndex !== index);
                        swap.source = null;
                        applyTeams(teams);
                        requestRedraw();
                    })}
                    onapply={ source && champions.some((champion) => champion === source.champion) && target && ctrl.apply }
                />
            );
            champions.forEach((champion) => inTeam[ champion.id ] = true);
        });
        const extras = roster.filter((champion) => !inTeam[ champion.id ] && ctrl.stars[ champion.attr.stars ]);
        if(extras.length >= ctrl.size) {
            while(create.champions.length < ctrl.size) {
                create.champions.push(null);
            }
            while(create.champions.length > ctrl.size) {
                create.champions.pop();
            }
            elements.push(
                <ChampionTeamSelector
                    key={ ++keys }
                    team={{
                        champions: create.champions,
                        synergies: create.synergies,
                    }}
                    swap={ swap }
                    onclick={(index) => {
                        if(source && source.create && source.index === index) {
                            swap.source = null;
                            if(swap.target && swap.target.team) {
                                swap.source = swap.target;
                                swap.target = null;
                            }
                        }
                        else {
                            if(!swap.target && swap.source && swap.source.id) {
                                swap.target = swap.source;
                            }
                            swap.source = {
                                team: create,
                                index,
                                champion: create.champions[ index ],
                                create: true,
                            };
                            if(target && target.champion && inTeam[ target.champion.id ]) {
                                swap.target = null;
                            }
                        }
                        calculateSynergies(swap);
                        requestRedraw();
                    }}
                    onapply={ source && target && source.create && target.champion && ctrl.apply }
                    onremove={ source && source.create && source.champion && !target && (() => {
                        create.champions[ swap.source.index ] = null;
                        create.synergies = synergiesFromChampions(create.champions);
                        swap.source = null;
                        applyTeams(teams);
                        requestRedraw();
                    }) }
                    create
                />
            );
            create.champions.forEach((champion) => champion && (inTeam[ champion.id ] = true));
        }
        extras.filter((champion) => champion && !inTeam[ champion.id ]).forEach((champion) => elements.push(
            <ChampionPortrait
                key={ ++keys }
                champion={ champion }
                editing={ target && target.champion && target.champion.id === champion.id }
                onclick={() => {
                    if(target && target.champion && target.champion.id === champion.id) {
                        swap.target = null;
                    }
                    else {
                        swap.target = {
                            champion,
                        };
                    }
                    calculateSynergies(swap);
                    requestRedraw();
                }}
            />
        ));
        return (
            <div m="TeamsPage" class="teams">
                <div>
                    { elements }
                </div>
                <div class="clear" />
            </div>
        );
    },
};

export default TeamsEditPage;

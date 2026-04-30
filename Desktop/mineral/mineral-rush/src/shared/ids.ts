/**
 * 게임 내 모든 ID 타입.
 * UNIVERSAL_GAME_FRAMEWORK §1.1 — 모든 ID는 strict typing.
 */

export type RunId = string & { readonly __brand: 'RunId' };
export type PlayerId = string & { readonly __brand: 'PlayerId' };
export type MineralId = string & { readonly __brand: 'MineralId' };
export type PickaxeId = string & { readonly __brand: 'PickaxeId' };
export type CardId = string & { readonly __brand: 'CardId' };
export type SkillNodeId = string & { readonly __brand: 'SkillNodeId' };
export type StageId = string & { readonly __brand: 'StageId' };

export const asRunId = (s: string): RunId => s as RunId;
export const asPlayerId = (s: string): PlayerId => s as PlayerId;
export const asMineralId = (s: string): MineralId => s as MineralId;
export const asPickaxeId = (s: string): PickaxeId => s as PickaxeId;
export const asCardId = (s: string): CardId => s as CardId;
export const asSkillNodeId = (s: string): SkillNodeId => s as SkillNodeId;
export const asStageId = (s: string): StageId => s as StageId;

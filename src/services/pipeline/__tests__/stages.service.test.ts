/** Tests for Pipeline Stages Service — Drizzle mocks */
jest.mock('@/lib/logger',()=>({dbLogger:{error:jest.fn(),info:jest.fn()}}))
jest.mock('@/repositories/pipeline',()=>({insertDefaultStages:jest.fn()}))
let results:any[][]=[],counter=0
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),orderBy:jest.fn(function(this:any){return this}),limit:jest.fn(function(this:any){return this}),insert:jest.fn(function(this:any){return this}),values:jest.fn(function(this:any){return this}),returning:jest.fn(function(this:any){return this}),update:jest.fn(function(this:any){return this}),set:jest.fn(function(this:any){return this}),delete:jest.fn(function(this:any){return this}),then:jest.fn(function(this:any,onF:any){const d=results[counter++]??results[results.length-1]??[];return Promise.resolve(typeof onF==='function'?onF(d):d)})} as any
jest.mock('@/lib/db/client',()=>{let d:any=null;return{getDb:jest.fn(()=>{if(!d)d=mdb;return d})}})
import{getDefaultStageId,getPipelineStages,createPipelineStage,updatePipelineStage,deletePipelineStage,reorderPipelineStages}from'../stages.service'
function seed(...s:any[][]){counter=0;results=s}
beforeEach(()=>{counter=0;results=[];jest.clearAllMocks()})
const baseStage={id:'s1',clinicId:'c1',name:'Novo',color:'#3B82F6',position:0,isDefault:true,isSystem:false,systemKey:null,createdAt:new Date(),updatedAt:new Date()}
describe('Pipeline Stages',()=>{
  describe('getDefaultStageId',()=>{it('returns id',async()=>{seed([{id:'s1'}]);expect(await getDefaultStageId('c1')).toBe('s1')});it('returns null',async()=>{seed([]);expect(await getDefaultStageId('c1')).toBeNull()})})
  describe('getPipelineStages',()=>{it('returns stages',async()=>{seed([baseStage]);const r=await getPipelineStages('c1');expect(r.length).toBe(1)})})
  describe('createPipelineStage',()=>{it('creates stage',async()=>{seed([],[],[{id:'s2',clinicId:'c1',name:'Test',color:'#000',position:1,isDefault:false}]);const r=await createPipelineStage({clinicId:'c1',name:'Test',color:'#000'});expect(r.name).toBe('Test')})})
  describe('updatePipelineStage',()=>{it('updates stage',async()=>{seed([{isDefault:false}],[{id:'s1',clinicId:'c1',name:'Updated',color:'#000',position:0,isDefault:false}]);const r=await updatePipelineStage('s1',{name:'Updated'});expect(r.name).toBe('Updated')})})
  describe('deletePipelineStage',()=>{it('deletes without leads',async()=>{seed([{id:'s1',clinicId:'c1',isDefault:false}],[{count:'0'}],[]);await deletePipelineStage('s1');expect(mdb.delete).toHaveBeenCalled()})})
  describe('reorderPipelineStages',()=>{it('reorders',async()=>{seed([{id:'s1'},{id:'s2'}],[],[],[]);await reorderPipelineStages([{id:'s1',sort_order:1},{id:'s2',sort_order:0}],'c1')})})
})

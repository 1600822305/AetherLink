// Memory MCP Server
// 移植自最佳实例的 Memory 服务器

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// 知识图谱类型定义
interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
}

interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

// 工具定义
const CREATE_ENTITIES_TOOL: Tool = {
  name: 'create_entities',
  description: '创建实体到知识图谱中',
  inputSchema: {
    type: 'object',
    properties: {
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '实体名称' },
            entityType: { type: 'string', description: '实体类型' },
            observations: {
              type: 'array',
              items: { type: 'string' },
              description: '关于实体的观察'
            }
          },
          required: ['name', 'entityType', 'observations']
        }
      }
    },
    required: ['entities']
  }
};

const CREATE_RELATIONS_TOOL: Tool = {
  name: 'create_relations',
  description: '在实体之间创建关系',
  inputSchema: {
    type: 'object',
    properties: {
      relations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string', description: '源实体名称' },
            to: { type: 'string', description: '目标实体名称' },
            relationType: { type: 'string', description: '关系类型' }
          },
          required: ['from', 'to', 'relationType']
        }
      }
    },
    required: ['relations']
  }
};

const READ_GRAPH_TOOL: Tool = {
  name: 'read_graph',
  description: '读取整个知识图谱',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

const SEARCH_NODES_TOOL: Tool = {
  name: 'search_nodes',
  description: '在知识图谱中搜索节点',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询'
      }
    },
    required: ['query']
  }
};

const OPEN_NODES_TOOL: Tool = {
  name: 'open_nodes',
  description: '打开特定的节点',
  inputSchema: {
    type: 'object',
    properties: {
      names: {
        type: 'array',
        items: { type: 'string' },
        description: '要打开的节点名称'
      }
    },
    required: ['names']
  }
};

// 知识图谱管理器
class KnowledgeGraphManager {
  private entities: Map<string, Entity> = new Map();
  private relations: Set<string> = new Set();
  private memoryPath: string;

  constructor(memoryPath: string = 'memory.json') {
    this.memoryPath = memoryPath;
    this.loadGraph();
  }

  // 序列化关系
  private serializeRelation(relation: Relation): string {
    return `${relation.from}|${relation.relationType}|${relation.to}`;
  }

  // 反序列化关系
  private deserializeRelation(relationStr: string): Relation {
    const [from, relationType, to] = relationStr.split('|');
    return { from, to, relationType };
  }

  // 加载知识图谱（移动端使用 localStorage）
  private async loadGraph(): Promise<void> {
    try {
      const data = localStorage.getItem(`mcp_memory_${this.memoryPath}`);
      if (data) {
        const graph: KnowledgeGraph = JSON.parse(data);
        this.entities.clear();
        this.relations.clear();
        graph.entities.forEach((entity) => this.entities.set(entity.name, entity));
        graph.relations.forEach((relation) => this.relations.add(this.serializeRelation(relation)));
      }
    } catch (error) {
      console.error('[Memory] 加载知识图谱失败:', error);
      this.entities = new Map();
      this.relations = new Set();
      await this.persistGraph(); // 创建空的图谱
    }
  }

  // 持久化知识图谱
  private async persistGraph(): Promise<void> {
    try {
      const graph: KnowledgeGraph = {
        entities: Array.from(this.entities.values()),
        relations: Array.from(this.relations).map((rStr) => this.deserializeRelation(rStr))
      };
      localStorage.setItem(`mcp_memory_${this.memoryPath}`, JSON.stringify(graph, null, 2));
    } catch (error) {
      console.error('[Memory] 持久化知识图谱失败:', error);
    }
  }

  // 创建实体
  async createEntities(entities: Entity[]): Promise<KnowledgeGraph> {
    for (const entity of entities) {
      const existingEntity = this.entities.get(entity.name);
      if (existingEntity) {
        // 合并观察
        const mergedObservations = Array.from(new Set([...existingEntity.observations, ...entity.observations]));
        this.entities.set(entity.name, {
          ...existingEntity,
          observations: mergedObservations
        });
      } else {
        this.entities.set(entity.name, entity);
      }
    }
    await this.persistGraph();
    return this.readGraph();
  }

  // 创建关系
  async createRelations(relations: Relation[]): Promise<KnowledgeGraph> {
    for (const relation of relations) {
      // 检查实体是否存在
      if (!this.entities.has(relation.from) || !this.entities.has(relation.to)) {
        throw new Error(`关系中的实体不存在: ${relation.from} -> ${relation.to}`);
      }
      this.relations.add(this.serializeRelation(relation));
    }
    await this.persistGraph();
    return this.readGraph();
  }

  // 读取整个图谱
  readGraph(): KnowledgeGraph {
    return {
      entities: Array.from(this.entities.values()),
      relations: Array.from(this.relations).map((rStr) => this.deserializeRelation(rStr))
    };
  }

  // 搜索节点
  async searchNodes(query: string): Promise<KnowledgeGraph> {
    const lowerCaseQuery = query.toLowerCase();
    const filteredEntities = Array.from(this.entities.values()).filter(
      (e) =>
        e.name.toLowerCase().includes(lowerCaseQuery) ||
        e.entityType.toLowerCase().includes(lowerCaseQuery) ||
        e.observations.some((o) => o.toLowerCase().includes(lowerCaseQuery))
    );

    const filteredEntityNames = new Set(filteredEntities.map((e) => e.name));

    const filteredRelations = Array.from(this.relations)
      .map((rStr) => this.deserializeRelation(rStr))
      .filter((r) => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to));

    return {
      entities: filteredEntities,
      relations: filteredRelations
    };
  }

  // 打开特定节点
  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const entities = names
      .map((name) => this.entities.get(name))
      .filter((entity): entity is Entity => entity !== undefined);

    const entityNames = new Set(names);
    const relations = Array.from(this.relations)
      .map((rStr) => this.deserializeRelation(rStr))
      .filter((r) => entityNames.has(r.from) || entityNames.has(r.to));

    return {
      entities,
      relations
    };
  }
}

export class MemoryServer {
  public server: Server;
  private knowledgeGraphManager: KnowledgeGraphManager;

  constructor(envPath: string = 'memory.json') {
    this.knowledgeGraphManager = new KnowledgeGraphManager(envPath);

    this.server = new Server(
      {
        name: 'memory-server',
        version: '1.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.initialize();
  }

  initialize() {
    // 工具处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        CREATE_ENTITIES_TOOL,
        CREATE_RELATIONS_TOOL,
        READ_GRAPH_TOOL,
        SEARCH_NODES_TOOL,
        OPEN_NODES_TOOL
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (!args) {
          throw new Error('未提供参数');
        }

        switch (name) {
          case 'create_entities': {
            if (!args.entities || !Array.isArray(args.entities)) {
              throw new Error('create_entities 需要 entities 数组参数');
            }
            const result = await this.knowledgeGraphManager.createEntities(args.entities as Entity[]);
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false
            };
          }

          case 'create_relations': {
            if (!args.relations || !Array.isArray(args.relations)) {
              throw new Error('create_relations 需要 relations 数组参数');
            }
            const result = await this.knowledgeGraphManager.createRelations(args.relations as Relation[]);
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false
            };
          }

          case 'read_graph': {
            const result = this.knowledgeGraphManager.readGraph();
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false
            };
          }

          case 'search_nodes': {
            if (!args.query || typeof args.query !== 'string') {
              throw new Error('search_nodes 需要 query 字符串参数');
            }
            const result = await this.knowledgeGraphManager.searchNodes(args.query);
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false
            };
          }

          case 'open_nodes': {
            if (!args.names || !Array.isArray(args.names)) {
              throw new Error('open_nodes 需要 names 数组参数');
            }
            const result = await this.knowledgeGraphManager.openNodes(args.names);
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false
            };
          }

          default:
            return {
              content: [{ type: 'text', text: `未知工具: ${name}` }],
              isError: true
            };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `错误: ${errorMessage}` }],
          isError: true
        };
      }
    });
  }
}

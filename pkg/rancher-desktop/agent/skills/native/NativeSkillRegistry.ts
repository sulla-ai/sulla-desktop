export interface NativeSkillDefinition {
  name: string;
  description: string;
  tags: string[];
  version: string;
  func: (input: any) => Promise<string>;
}

export class NativeSkillRegistry {
  private skills = new Map<string, NativeSkillDefinition>();
  private static instance: NativeSkillRegistry | null = null;

  static getInstance(): NativeSkillRegistry {
    return this.instance ?? (this.instance = new NativeSkillRegistry());
  }

  private constructor() {}

  register(def: NativeSkillDefinition): void {
    this.skills.set(def.name, def);
  }

  get(name: string): NativeSkillDefinition | undefined {
    return this.skills.get(name);
  }

  getAll(): NativeSkillDefinition[] {
    return Array.from(this.skills.values());
  }

  search(query: string): NativeSkillDefinition[] {
    const q = query.toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    return this.getAll().filter(s => {
      const haystack = [s.name, s.description, ...s.tags].join(' ').toLowerCase();
      return words.some(w => haystack.includes(w));
    });
  }
}

export const nativeSkillRegistry = NativeSkillRegistry.getInstance();

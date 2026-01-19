export interface Project {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    compose: string;
    x: number;
    y: number;
}

export interface ServiceNode {
    id: string;
    name: string;
    image?: string;
    ports?: string[];
    volumes?: string[];
    environment?: Record<string, string>;
    dependsOn?: string[];
    networks?: string[];
}

export interface ComposeFile {
    version?: string;
    services: Record<string, ServiceConfig>;
    networks?: Record<string, NetworkConfig>;
    volumes?: Record<string, VolumeConfig>;
}

export interface ServiceConfig {
    image?: string;
    build?: string | { context: string; dockerfile?: string };
    ports?: string[];
    volumes?: string[];
    environment?: string[] | Record<string, string>;
    depends_on?: string[] | Record<string, { condition: string }>;
    networks?: string[];
    command?: string | string[];
    healthcheck?: {
        test: string | string[];
        interval?: string;
        timeout?: string;
        retries?: number;
    };
    deploy?: {
        replicas?: number;
        resources?: {
            limits?: { cpus?: string; memory?: string };
            reservations?: { cpus?: string; memory?: string };
        };
    };
}

export interface NetworkConfig {
    driver?: string;
    external?: boolean;
}

export interface VolumeConfig {
    driver?: string;
    external?: boolean;
}

export interface ServiceStatus {
    name: string;
    status: string;
    health?: string;
}

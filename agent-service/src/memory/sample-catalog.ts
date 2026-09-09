import type { MemoryType } from '../types.js';

export type MemorySampleCategory =
  | 'database-storage'
  | 'cache-capacity'
  | 'messaging-async'
  | 'config-contract'
  | 'security-external';

export interface MemorySampleDefinition {
  id: string;
  category: MemorySampleCategory;
  categoryLabel: string;
  type: MemoryType;
  title: string;
  summary: string;
  serviceName: string;
  confidence: number;
  importance: number;
  sourceDocument: {
    id: string;
    path: string;
    updatedAt: string;
  };
  content: {
    servicePath: string[];
    symptom: string;
    rootCause: string;
    signals: string[];
    diagnosis: string[];
    remediation: string[];
    verification: string[];
    sourceExcerpt: string;
  };
}

export interface MemorySampleCatalogItem extends Omit<MemorySampleDefinition, 'content'> {
  generatedMemoryId: string;
}

export const memorySampleCatalog: MemorySampleDefinition[] = [
  {
    id: 'postgres-autovacuum-table-bloat',
    category: 'database-storage',
    categoryLabel: '数据库与存储',
    type: 'procedural',
    title: 'PostgreSQL 自动清理滞后与表膨胀处置',
    summary: '推荐位变慢或为空时，沿 frontend -> recommendation -> product-catalog -> postgres 检查 autovacuum 滞后、dead tuples 与表膨胀。',
    serviceName: 'postgres',
    confidence: 91,
    importance: 86,
    sourceDocument: {
      id: 'rec-rail-deep-postgres-autovacuum-causal-chain-01',
      path: 'experiments/multihop_corpus/docs_naturalistic_24/rec_rail_deep_postgres__autovacuum/rec-rail-deep-postgres-autovacuum-causal-chain-01.md',
      updatedAt: '2026-07-03',
    },
    content: {
      servicePath: ['frontend', 'recommendation', 'product-catalog', 'postgres'],
      symptom: '商品页主体正常，但推荐位在负载升高时持续空白或填充缓慢。',
      rootCause: 'PostgreSQL autovacuum 滞后造成 dead tuples 与 table bloat，查询等待从 product-catalog 向上传播。',
      signals: ['autovacuum', 'dead tuples', 'table bloat', 'vacuum', 'transaction wraparound'],
      diagnosis: [
        '优先检查 product-catalog -> postgres 边的延迟、错误率和等待时间。',
        '核对 pg_stat_user_tables 中 dead tuple 数量、最近 vacuum 时间和长事务。',
        '只有根服务缺少 autovacuum 或 dead tuples 信号时，才把调查退回 recommendation。',
      ],
      remediation: [
        '终止阻塞自动清理的异常长事务，并确认业务允许。',
        '按表评估 VACUUM ANALYZE，避免直接执行高风险全库操作。',
        '调整 autovacuum 阈值前先记录表增长率、写入量和维护窗口。',
      ],
      verification: ['dead tuples 持续下降', 'product-catalog 数据库等待恢复', '推荐位延迟与空结果率回落'],
      sourceExcerpt: 'postgres 先出现 autovacuum lag / table bloat，然后 product-catalog 的调用等待变长，再沿 frontend -> recommendation -> product-catalog -> postgres 传播成用户可见症状。',
    },
  },
  {
    id: 'valkey-maxclients-saturation',
    category: 'cache-capacity',
    categoryLabel: '缓存与容量',
    type: 'procedural',
    title: 'Valkey 最大连接数耗尽排查',
    summary: '结账阶段购物篮清空或间歇性 500 时，优先检查 valkey-cart 的 maxclients 饱和与 cart 客户端连接行为。',
    serviceName: 'valkey-cart',
    confidence: 91,
    importance: 90,
    sourceDocument: {
      id: 'cart-500-deep-valkey-maxclients-causal-chain-01',
      path: 'experiments/multihop_corpus/docs_naturalistic_24/cart_500_deep_valkey__maxclients/cart-500-deep-valkey-maxclients-causal-chain-01.md',
      updatedAt: '2026-07-03',
    },
    content: {
      servicePath: ['frontend', 'checkout', 'cart', 'valkey-cart'],
      symptom: '购物篮在商品页正常，但进入结账后显示为空、被重置或返回间歇性 500。',
      rootCause: 'valkey-cart 达到最大客户端连接数，cart 调用等待、重试并向 checkout 传播泛化错误。',
      signals: ['maxclients', 'max number of clients reached', 'connection refused', 'cart timeout'],
      diagnosis: [
        '先查看 cart -> valkey-cart 边是否最早出现错误或延迟。',
        '对照当前 connected_clients、maxclients、blocked_clients 和连接创建速率。',
        '检查 cart 是否存在连接泄漏、过大的连接池或重试风暴。',
      ],
      remediation: [
        '优先修复连接复用或泄漏，再评估临时提高 maxclients。',
        '限制无退避重试并校准客户端 deadline，避免放大连接压力。',
        '扩容前确认文件描述符、内存和代理连接上限同步满足。',
      ],
      verification: ['拒绝连接日志停止增长', '连接使用率回到安全水位', '购物篮读取与结账成功率恢复'],
      sourceExcerpt: 'valkey-cart 先出现 valkey maxclients connection saturation，然后 cart 的调用等待变长，并沿 frontend -> checkout -> cart -> valkey-cart 传播成用户可见症状。',
    },
  },
  {
    id: 'redis-background-persistence-jitter',
    category: 'cache-capacity',
    categoryLabel: '缓存与容量',
    type: 'semantic',
    title: 'Redis 后台持久化竞争导致查询抖动',
    summary: '商品列表变慢且查询超时时，应同时检查缓存命中率、回源压力以及后台持久化是否占用快速读取路径。',
    serviceName: 'redis-cache',
    confidence: 88,
    importance: 80,
    sourceDocument: {
      id: 'semantic-case-035-semantic-root-01',
      path: 'experiments/multihop_corpus/docs_semantic/productcatalog_cache_redis__persistence/semantic-case-035-semantic-root-01.md',
      updatedAt: '2026-07-04',
    },
    content: {
      servicePath: ['frontend', 'product-catalog-service', 'redis-cache'],
      symptom: '商品列表与查找请求出现抖动，部分请求在返回有效内容前超时。',
      rootCause: 'redis-cache 后台保存与快速读取路径竞争资源，命中稳定性下降并触发更多慢速回源。',
      signals: ['background save', 'fork latency', 'cache miss', 'origin load', 'latency jitter'],
      diagnosis: [
        '同时观察缓存命中率、回源 QPS、持久化状态和实例延迟。',
        '区分读取本身变慢与持久化期间的周期性延迟峰值。',
        '检查磁盘吞吐、写时复制内存和实例内存碎片。',
      ],
      remediation: ['调整持久化窗口或策略', '降低热点键写放大', '必要时拆分读写压力或迁移持久化负载'],
      verification: ['延迟峰值不再与后台保存重合', '命中率稳定', 'product-catalog 回源压力恢复基线'],
      sourceExcerpt: '后台持久化一旦拖住主路径，redis-cache 会把压力向上游传播；应先看命中率和回源压力，再判断是否需要修改商品列表逻辑。',
    },
  },
  {
    id: 'kafka-consumer-rebalance-lag',
    category: 'messaging-async',
    categoryLabel: '消息与异步',
    type: 'semantic',
    title: 'Kafka 消费组重平衡导致历史视图滞后',
    summary: '订单历史持续落后时，不应只检查页面缓存，还要检查消费积压扩大和消费组所有权频繁迁移。',
    serviceName: 'kafka-broker',
    confidence: 88,
    importance: 84,
    sourceDocument: {
      id: 'semantic-case-032-semantic-root-01',
      path: 'experiments/multihop_corpus/docs_semantic/orderhistory_kafka_accounting__rebalance/semantic-case-032-semantic-root-01.md',
      updatedAt: '2026-07-04',
    },
    content: {
      servicePath: ['order-history-service', 'accounting-service', 'kafka-broker'],
      symptom: '交易历史视图持续过期，新活动不能及时反映，表现类似页面缓存未刷新。',
      rootCause: '消费组频繁重平衡导致分区所有权反复迁移，处理节奏不均并形成持续积压。',
      signals: ['consumer lag', 'rebalance', 'partition revoke', 'partition assign', 'group instability'],
      diagnosis: [
        '先确认消费积压是否持续扩大，而不是短暂尖峰。',
        '检查成员加入退出、session timeout、处理时长和分区重新分配频率。',
        '将页面数据时间戳与消息消费进度对齐，避免误判为展示层缓存。',
      ],
      remediation: ['稳定消费者实例数量', '缩短单批处理阻塞时间', '校准会话与最大处理间隔', '减少无必要的频繁发布'],
      verification: ['重平衡频率下降', '消费 lag 连续收敛', '历史视图时间差恢复到目标范围'],
      sourceExcerpt: '消费进度追不上新事件时，历史视图会被拖出明显时间差；消费组频繁迁移会让处理节奏反复抖动并表现为持续不稳定。',
    },
  },
  {
    id: 'smtp-starttls-handshake-failure',
    category: 'messaging-async',
    categoryLabel: '消息与异步',
    type: 'procedural',
    title: 'SMTP STARTTLS 握手失败处置',
    summary: '订单已成功但确认邮件未送达时，沿 checkout -> email -> smtp-relay 检查 STARTTLS、证书和中继策略。',
    serviceName: 'smtp-relay',
    confidence: 91,
    importance: 82,
    sourceDocument: {
      id: 'order-confirm-deep-smtp-starttls-causal-chain-01',
      path: 'experiments/multihop_corpus/docs_naturalistic_24/order_confirm_deep_smtp__starttls/order-confirm-deep-smtp-starttls-causal-chain-01.md',
      updatedAt: '2026-07-03',
    },
    content: {
      servicePath: ['frontend', 'checkout', 'email', 'smtp-relay'],
      symptom: '订单和扣款均成功，但用户没有收到确认邮件。',
      rootCause: 'smtp-relay STARTTLS 握手失败，email 服务重试或超时，但不影响已完成的交易主路径。',
      signals: ['starttls', 'tls handshake', 'certificate', '530 5.7.0', 'relay rejected'],
      diagnosis: ['检查 email -> smtp-relay 边的失败时间', '验证中继端口和 STARTTLS 能力', '核对证书链、主机名与中继策略'],
      remediation: ['更新或补齐证书链', '修正中继 TLS 策略', '保留失败邮件并在链路恢复后受控重投'],
      verification: ['STARTTLS 握手成功', '待发送队列持续下降', '新订单确认邮件按目标时延送达'],
      sourceExcerpt: 'smtp-relay 先出现 STARTTLS handshake failure，然后 email 的调用等待变长；上游订单流程可能成功，因此必须把通知失败与交易失败分开判断。',
    },
  },
  {
    id: 'feature-flag-config-drift',
    category: 'config-contract',
    categoryLabel: '配置与契约',
    type: 'semantic',
    title: '特性开关配置漂移导致分流回退',
    summary: '个性化推荐大面积回退到默认分组时，应检查规则版本、分发状态与本地缓存是否一致。',
    serviceName: 'feature-flag-service',
    confidence: 88,
    importance: 82,
    sourceDocument: {
      id: 'semantic-case-040-semantic-root-01',
      path: 'experiments/multihop_corpus/docs_semantic/frontend_recommendation_featureflag__config_drift/semantic-case-040-semantic-root-01.md',
      updatedAt: '2026-07-04',
    },
    content: {
      servicePath: ['frontend', 'recommendation-service', 'feature-flag-service'],
      symptom: '大量访问者进入相同的默认推荐分组，同一路径可能出现两种不一致结果。',
      rootCause: '特性开关分发版本与本地缓存漂移，配置结构或规则版本分叉后触发默认回退。',
      signals: ['rule version', 'config drift', 'stale cache', 'fallback cohort', 'distribution lag'],
      diagnosis: ['对比控制面版本与各实例已加载版本', '检查规则结构兼容性', '确认默认回退率是否与发布或缓存刷新时间重合'],
      remediation: ['重新同步规则版本', '清理失效缓存', '为配置结构引入兼容校验和渐进发布'],
      verification: ['实例版本一致', '默认回退率恢复基线', '同一用户的分流结果保持稳定'],
      sourceExcerpt: '配置结构和线上版本一旦分叉，分流判断会不一致；应先确认规则版本对齐，再调查前台为什么全部落回默认。',
    },
  },
  {
    id: 'quote-provider-schema-mismatch',
    category: 'config-contract',
    categoryLabel: '配置与契约',
    type: 'episodic',
    title: '运费报价响应契约不兼容事件',
    summary: '部分地址在结账运费步骤返回 500 时，应检查 quote 提供方响应字段与 shipping 反序列化契约。',
    serviceName: 'quote',
    confidence: 91,
    importance: 86,
    sourceDocument: {
      id: 'shipping-deep-quote-schemamismatch-causal-chain-01',
      path: 'experiments/multihop_corpus/docs_naturalistic_24/shipping_deep_quote__schemamismatch/shipping-deep-quote-schemamismatch-causal-chain-01.md',
      updatedAt: '2026-07-03',
    },
    content: {
      servicePath: ['frontend', 'checkout', 'shipping', 'quote'],
      symptom: '部分地址无法获得运费估算，结账在 shipping 步骤返回 500。',
      rootCause: 'quote 提供方响应结构变化，shipping 使用旧契约反序列化并产生解析错误。',
      signals: ['schema', 'unexpected field', 'deserialization', 'contract', 'parse error'],
      diagnosis: ['优先查看 shipping -> quote 的原始响应与状态码', '对比成功和失败地址的响应结构', '核对提供方版本与本地契约发布时间'],
      remediation: ['增加向后兼容解析', '为未知字段提供容错', '通过契约测试和灰度发布验证提供方变更'],
      verification: ['失败样本可成功解析', 'shipping 500 消失', '不同地址类型均能返回运费估算'],
      sourceExcerpt: 'quote 先出现 response schema mismatch，然后 shipping 调用失败，并沿 frontend -> checkout -> shipping -> quote 传播为结账 500。',
    },
  },
  {
    id: 'rates-api-tls-certificate-expiry',
    category: 'security-external',
    categoryLabel: '安全与外部依赖',
    type: 'procedural',
    title: '汇率服务 TLS 证书过期排查',
    summary: '非默认币种在订单总额计算阶段失败时，应检查 currency -> ecb-rates-api 的证书有效期、主机名和完整证书链。',
    serviceName: 'ecb-rates-api',
    confidence: 91,
    importance: 90,
    sourceDocument: {
      id: 'checkout-deep-ecb-rates-tlscert-causal-chain-01',
      path: 'experiments/multihop_corpus/docs_naturalistic_24/checkout_deep_ecb_rates__tlscert/checkout-deep-ecb-rates-tlscert-causal-chain-01.md',
      updatedAt: '2026-07-03',
    },
    content: {
      servicePath: ['frontend', 'checkout', 'currency', 'ecb-rates-api'],
      symptom: '购物车和配送正常，但部分非默认币种在计算总额或最终下单时失败。',
      rootCause: 'ecb-rates-api TLS 证书过期或证书链校验失败，currency 无法获取汇率。',
      signals: ['certificate expired', 'x509', 'tls handshake failed', 'ssl', 'hostname mismatch'],
      diagnosis: ['从 currency 运行环境验证证书链', '确认系统时间与信任库', '对照失败币种是否调用同一外部端点'],
      remediation: ['更新外部端点证书或信任链', '配置证书到期监测', '在不降低 TLS 校验的前提下准备受控降级路径'],
      verification: ['TLS 握手与主机名校验通过', '汇率请求恢复', '非默认币种订单成功率回到基线'],
      sourceExcerpt: 'ecb-rates-api 先出现 rates API TLS certificate expiry，然后 currency 调用等待变长，再沿 checkout 链路传播为特定币种下单失败。',
    },
  },
  {
    id: 'payment-fraud-review-hold',
    category: 'security-external',
    categoryLabel: '安全与外部依赖',
    type: 'semantic',
    title: '支付风控挂起与失败状态区分',
    summary: '支付授权停在中间态时，应先区分风控挂起、明确拒绝和网络超时，再判断是否属于结账逻辑故障。',
    serviceName: 'payment-gateway-api',
    confidence: 87,
    importance: 88,
    sourceDocument: {
      id: 'semantic-case-027-semantic-root-01',
      path: 'experiments/multihop_corpus/docs_semantic/checkout_payment_gateway__fraud_hold/semantic-case-027-semantic-root-01.md',
      updatedAt: '2026-07-04',
    },
    content: {
      servicePath: ['checkout-service', 'payment-service', 'payment-gateway-api'],
      symptom: '最终支付交接无法完成，用户看到未决、等待或泛化失败状态。',
      rootCause: '交易被外部支付网关送入风控复核队列；挂起并不等于失败，但会让结算停留在中间态。',
      signals: ['fraud hold', 'risk review', 'pending authorization', 'gateway decision', 'manual review'],
      diagnosis: ['检查网关原始状态和原因码', '区分 pending、declined 与 timeout', '确认本地状态机是否正确保留未决交易'],
      remediation: ['为挂起状态配置明确的轮询或回调处理', '避免把未决交易立即重试为重复扣款', '向用户展示可恢复的处理中状态'],
      verification: ['网关回调可推进本地状态', '不存在重复授权', '挂起交易在目标时间内完成或明确关闭'],
      sourceExcerpt: '风控挂起并不等于支付失败，但会把整条链路停在等待的中间态；应先看网关返回节奏和拒绝原因，再判断结账流程。',
    },
  },
];

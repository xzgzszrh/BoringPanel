// Removes only SigNoz-owned community, documentation, support, and repository links.
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const sourceRoot = path.join(process.cwd(), 'src');
const bannedDomain = /(?:signoz\.io|signoz-community\.slack\.com|trust\.signoz\.io|github\.com\/(?:SigNoz|signoz)|^\/docs\/|^\/upgrade-from-app)/i;
const bannedUrl = /https?:\/\/(?:[^\s"'`<>)]*\.)?(?:signoz\.io|signoz-community\.slack\.com|trust\.signoz\.io)[^\s"'`<>)]*|https?:\/\/github\.com\/(?:SigNoz|signoz)\/[^\s"'`<>)]*|\/docs\/[^\s"'`<>)]*|\/upgrade-from-app/gi;

function sourceFiles(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(entryPath);
		return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
	});
}

for (const file of sourceFiles(sourceRoot)) {
	const input = fs.readFileSync(file, 'utf8');
	const ast = parser.parse(input, {
		sourceType: 'module',
		plugins: ['typescript', 'jsx', 'decorators-legacy'],
	});
	let changed = false;

	traverse(ast, {
		JSXElement(elementPath) {
			const attributes = elementPath.node.openingElement.attributes;
			const bannedAttribute = attributes.find(
				(attribute) =>
					attribute.type === 'JSXAttribute' &&
					['href', 'url'].includes(attribute.name.name) &&
					attribute.value?.type === 'StringLiteral' &&
					bannedDomain.test(attribute.value.value),
			);
			if (bannedAttribute) {
				elementPath.remove();
				changed = true;
				return;
			}

			for (const attribute of attributes) {
				if (
					attribute.type === 'JSXAttribute' &&
					attribute.name.name === 'docsURL' &&
					attribute.value?.type === 'StringLiteral' &&
					bannedDomain.test(attribute.value.value)
				) {
					attribute.value = null;
					changed = true;
				}
			}
		},
		StringLiteral(stringPath) {
			const nextValue = stringPath.node.value.replace(bannedUrl, '');
			if (nextValue !== stringPath.node.value) {
				stringPath.node.value = nextValue;
				changed = true;
			}
		},
		JSXText(textPath) {
			const nextValue = textPath.node.value.replace(bannedUrl, '');
			if (nextValue !== textPath.node.value) {
				textPath.node.value = nextValue;
				changed = true;
			}
		},
		TemplateElement(templatePath) {
			const nextRaw = templatePath.node.value.raw.replace(bannedUrl, '');
			if (nextRaw !== templatePath.node.value.raw) {
				templatePath.node.value.raw = nextRaw;
				templatePath.node.value.cooked = nextRaw;
				changed = true;
			}
		},
	});

	if (changed) {
		fs.writeFileSync(
			file,
			`${generate(ast, { retainLines: true }, input).code}\n`,
		);
	}
}

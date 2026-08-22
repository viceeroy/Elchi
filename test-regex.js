const html = `    <meta
      name="description"
      content="Sayohatchilar va pochta yubormoqchi bo'lganlar uchun bepul e'lon taxtasi."
    />`;

const regex = new RegExp(`(<meta\\s+(?:name|property)="description"\\s+content=")[^"]*(")`, 'g');
console.log(html.replace(regex, `$1NEW_DESC$2`));

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_PROPERTIES } from '../data/initialData';
import {
  buildAgentConversationReply,
  extractCriteriaLocally,
  hasSufficientCriteriaToSearch,
  mergeConversationalCriteria,
  verifyPropertiesAgainstCriteria,
  asksForKnownSearchCriteria,
} from './aiConversationalAgent';

const query = 'quiero una casa para comprar en Quilmes que tenga 3 habitaciones y un garage que este entre los 2000 usd';
const criteria = mergeConversationalCriteria({}, query, extractCriteriaLocally(query));
const property = {
  ...INITIAL_PROPERTIES[0],
  id: 'catalog-test',
  location: 'Quilmes',
  address: 'Mitre 450, Quilmes',
  operationType: 'venta' as const,
  propertyType: 'casa',
  price: 2000,
  currency: 'USD' as const,
  bedrooms: 3,
  features: ['cochera'],
  publicationStatus: 'aprobada' as const,
  availability: 'disponible' as const,
};

test('busca con el presupuesto explícito y conserva todos los requisitos', () => {
  assert.equal(criteria.operationType, 'venta');
  assert.ok(criteria.locations?.includes('Quilmes'));
  assert.equal(criteria.minBedrooms, 3);
  assert.deepEqual(criteria.requiredFeatures, ['cochera']);
  assert.equal(criteria.maxPrice, 2000);
  assert.equal(criteria.currency, 'USD');
  assert.equal(hasSufficientCriteriaToSearch(criteria), true);
  const result = verifyPropertiesAgainstCriteria([property], criteria);
  assert.deepEqual(result.exactMatches.map(p => p.id), [property.id]);
});

test('no presenta precios mayores ni propiedades sin garage como coincidencias exactas', () => {
  const result = verifyPropertiesAgainstCriteria([
    { ...property, id: 'expensive', price: 200000 },
    { ...property, id: 'no-garage', features: [], description: '' },
    { ...property, id: 'unapproved', publicationStatus: 'pendiente' },
  ], criteria);
  assert.equal(result.exactMatches.length, 0);
});

test('recupera una conversación bloqueada por la validación anterior', () => {
  const previous = { ...criteria, isAmbiguousOrUnrealisticBudget: true };
  const message = 'para comprar en Quilmes';
  const merged = mergeConversationalCriteria(previous, message, extractCriteriaLocally(message));
  assert.equal(hasSufficientCriteriaToSearch(merged), true);
  assert.equal(merged.maxPrice, 2000);
  assert.equal(merged.minBedrooms, 3);
  const result = verifyPropertiesAgainstCriteria([property], merged);
  const reply = buildAgentConversationReply(message, previous, merged, result, [property]);
  assert.match(reply.message, /coinciden/);
});

test('un catálogo vacío no genera publicaciones', () => {
  const result = verifyPropertiesAgainstCriteria([], criteria);
  assert.equal(result.exactMatches.length, 0);
  assert.equal(result.alternativeMatches.length, 0);
});

test('rechaza repreguntas de la IA sobre requisitos ya reconocidos', () => {
  assert.equal(asksForKnownSearchCriteria(
    '¿Podrías indicarme la zona, barrio o dirección y si preferís comprar o alquilar?', criteria
  ), true);
  assert.equal(asksForKnownSearchCriteria('¿En qué zona buscás?', criteria), true);
  assert.equal(asksForKnownSearchCriteria('¿Preferís comprar o alquilar?', criteria), true);
  assert.equal(asksForKnownSearchCriteria('Encontré propiedades que coinciden. ¿Te gustaría ver la ficha?', criteria), false);
  assert.equal(asksForKnownSearchCriteria('¿En qué zona buscás?', {}), false);
});

test('separa ubicaciones desconocidas de requisitos sin corregir nombres por suposición', () => {
  const cases = [
    ['necesito buscar un departamento en merlos que tenga patio y 2 habitaciones para alquilar', 'Merlos'],
    ['busco una casa en Villa Elisa donde pueda tener mascotas', 'Villa Elisa'],
    ['busco un departamento en San Antonio de Areco con patio para alquilar', 'San Antonio de Areco'],
    ['quiero una casa en San Carlos de Bariloche que cuente con garage', 'San Carlos de Bariloche'],
    ['busco en Villa Nueva y con dos dormitorios', 'Villa Nueva'],
    ['busco en Villa Nueva, que tenga patio', 'Villa Nueva'],
    ['busco en la localidad de Villa Nueva sin expensas', 'Villa Nueva'],
    ['departamento en Villa Nueva; necesito patio', 'Villa Nueva'],
  ];
  for (const [message, expected] of cases) {
    assert.deepEqual(extractCriteriaLocally(message).locations, [expected], message);
  }
  const result = extractCriteriaLocally(cases[0][0]);
  assert.equal(result.operationType, 'alquiler');
  assert.equal(result.minBedrooms, 2);
  assert.ok(result.requiredFeatures?.includes('patio'));
});

test('conserva calles con artículos, fechas y alturas sin agregar requisitos', () => {
  for (const [message, expected] of [
    ['busco en Av. Cabildo 1500 que tenga patio', 'Av. Cabildo 1500'],
    ['busco en calle 9 de Julio 450 con cochera', 'calle 9 de Julio 450'],
    ['busco en avenida de los Incas 3200 para alquilar', 'avenida de los Incas 3200'],
    ['busco en Mitre 450 que tenga dos dormitorios', 'Mitre 450'],
  ]) {
    assert.equal(extractCriteriaLocally(message).requestedAddress, expected, message);
  }
});

test('conserva localidades conocidas, tildes, proximidad y múltiples barrios', () => {
  assert.deepEqual(extractCriteriaLocally('casa en Quilmes con patio').locations, ['Quilmes']);
  assert.deepEqual(extractCriteriaLocally('casa en Mar del Plata que tenga garage').locations, ['Mar del Plata']);
  assert.deepEqual(extractCriteriaLocally('casa en San Francisco Solano').locations, ['San Francisco Solano']);
  assert.deepEqual(extractCriteriaLocally('casa en Ituzaingó').locations, ['Ituzaingó']);
  assert.deepEqual(new Set(extractCriteriaLocally('en Palermo o Belgrano para comprar').locations), new Set(['Palermo', 'Belgrano']));
  assert.equal(extractCriteriaLocally('casa cerca de CABA con patio').isProximitySearch, true);
});

test('no convierte formas de pago o comodidades entre paréntesis en zonas', () => {
  assert.deepEqual(extractCriteriaLocally('quiero pagar en pesos con cuotas').locations, []);
  assert.deepEqual(extractCriteriaLocally('busco un departamento (con patio)').locations, []);
});

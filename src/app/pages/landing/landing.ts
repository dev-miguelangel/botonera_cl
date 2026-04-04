import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
})
export class Landing {
  casos = [
    { emoji: '🏫', titulo: 'Colegios', desc: 'Avisa a los apoderados cuando el almuerzo está listo o hay un citación urgente.' },
    { emoji: '🏠', titulo: 'Familias', desc: 'Coordina sin llamadas. "Ya llegué", "a comer", "ven urgente".' },
    { emoji: '🏥', titulo: 'Clínicas', desc: 'Llama al siguiente paciente o avisa al personal de turno con un solo toque.' },
    { emoji: '🍽️', titulo: 'Restaurantes', desc: 'Notifica a la cocina, al personal de sala o a los clientes en lista de espera.' },
    { emoji: '💼', titulo: 'Oficinas', desc: 'Alerta a tu equipo cuando la sala de reuniones está libre o el café está listo.' },
    { emoji: '👴', titulo: 'Cuidado de adultos', desc: 'El familiar presiona el botón y todos los cuidadores reciben el aviso al instante.' },
  ];
}

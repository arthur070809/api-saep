use estoque;

insert into produtos (nome, valor, quantidade, categoria)        -- população da tabela--
values ("celular", 250, 13, "tecnologia"),
("tablet", 370, 5, "tecnologia"),
("notebook", "720", 2, "tecnologia");

insert into movimentacoes (dt, tipo, quantidade, produtos_id)
values (now(), "entrada", 10,1),
(now(), "saida", 15,2),
(now(), "entrada", 20,3);

create view vw_estoque AS
select nome, quantidade * valor
from produtos;
select * from vw_estoque